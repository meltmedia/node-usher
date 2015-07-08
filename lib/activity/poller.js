/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var winston = require('winston'),
    events = require('events'),
    util = require('util'),
    os = require('os'),
    _ = require('lodash'),
    async = require('async'),
    swf = require('aws-swf'),
    AWS = require('aws-sdk'),
    backoff = require('backoff'),
    semver = require('semver'),
    usherUtil = require('../util'),
    ActivityRunner = require('./runner'),
    Task = require('./task');


module.exports = ActivityPoller;

/**
 * Represents a single, named poller, where all activities are defined.
 * @constructor
 * @param {string} name - The name of the poller. This is arbitrary and has no bering on SWF.
 * @param {string} domain - The AWS SWF domain name to execute this pollers activities in.
 * @param {object} [options] - Additional options used when polling for new activities
 *                             (taskList)
 */
function ActivityPoller(name, domain, options) {
  if (!(this instanceof ActivityPoller)) {
    return new ActivityPoller(name, domain, options);
  }

  events.EventEmitter.call(this);

  if (!_.isString(name)) {
    throw new Error('A `name` is required');
  }

  if (!_.isString(domain)) {
    throw new Error('A `domain` is required');
  }

  this.name = name;
  this.domain = domain;
  this.options = options || {};

  // Make sure taskList is an object of { name: '' }
  if (this.options.taskList && _.isString(this.options.taskList)) {
    this.options.taskList = { name: this.options.taskList };
  }

  // Set default taskList if not defined
  if (!this.options.taskList) {
    this.options.taskList = { name: this.name + '-tasklist' };
  }

  /** @private */
  this._registrations = [];
  this._activities = {};
  this._poller = undefined;

}


// Make Workflow an extention of Fragment
util.inherits(ActivityPoller, events.EventEmitter);


/**
 * Add an activity to the workflow
 * @param {string} name - The unique name of the activity.
 * @param {string} version - Version(s) this activity can handle (conforms to v2.0 of http://semver.org)
 * @param {ActivityPoller~activityFn} activityFn - Function to execute when this activity is invoked
 * @returns {ActivityPoller} This Poller so you can chain commands.
 */
ActivityPoller.prototype.activity = function activity(name, version, activityFn) {

  var instance = new ActivityRunner(name, version, activityFn);

  if (!_.isArray(this._activities[name])) { this._activities[name] = []; }

  // Add the activity runner
  this._activities[name].push(instance);

  // Sort the activities by their version so we can pick the best first match
  this._activities[name].sort(function (a1, a2) {
    return semver.compare(a1.version, a2.version);
  });

  return this; // chainable
};

/**
 * The business logic to run when this activity executes
 * @callback ActivityPoller~activityFn
 * @param {ActivityTask} task - The results of all dependencies for this decision
 */


/**
 * Register a SWF Activity
 * @param {string} name - The name of the activity.
 * @param {string} version - The AWS version of the activity being registered.
 * @returns {ActivityPoller} This Poller so you can chain commands.
 */
ActivityPoller.prototype.register = function register(name, version) {
  this._registrations.push({ name: name, version: version });
  return this;
};


/**
 * Start listening for activity tasks from SWF
 * @returns {ActivityPoller} This workflow so you can chain commands.
 */
ActivityPoller.prototype.start = function start() {

  var self = this;

  // If we already have a poller, skip setup
  if (!_.isEmpty(this._poller)) {
    return this;
  }

  // Define the actual poller instance
  var config = {
    'domain': this.domain,
    'taskList': this.options.taskList,
    'identity': this.name + '-' + os.hostname() + '-' + process.pid
  };
  this._poller = new swf.ActivityPoller(config, new AWS.SimpleWorkflow());

  // Handle any activity task handed to us
  this._poller.on('activityTask', this._onActivityTask.bind(this));


  // Setup poller restart backoff strategy
  this._pollerBackoff = backoff.fibonacci({
    randomisationFactor: 0,
    initialDelay: 10,
    maxDelay: 30000
  });

  this._pollerBackoff.on('backoff', function (number, delay) {
    winston.log('warn', 'Poller: %s failed %d time(s), restarting in %d ms', self.name, number, delay, {});
  });

  this._pollerBackoff.on('ready', function () {
    winston.log('info', 'Restarting poller: %s', self.name);
    self._poller.start();
  }.bind(this));

  this._pollerBackoff.on('fail', function (number) {
    winston.log('error', 'Poller: %s failed too many times [%d], will not restart', self.name, number, {});
  });


  // For debug purposes only
  this._poller.on('poll', function () {
    winston.log('silly', 'Polling for activity tasks in poller: %s ...', self.name);
  });

  this._poller.on('error', function (err) {
    winston.log('error', 'An error occured in poller: %s due to: ', self.name, err);
    // Attempt to start polling again
    self._pollerBackoff.backoff();
  }.bind(this));


  // Ensure activities are registered, then start polling
  winston.log('debug', 'Registering %s activities', this._registrations.length);
  this._registerActivities(function () {
    if (!_.isEmpty(self._poller)) {
      // Start the poller
      winston.log('info', 'Starting poller: %s', self.name);
      winston.log('debug', '\t-- Using config: ', config);
      self._poller.start();
    }
  });

  return this; // chainable
};


/**
 * Stop listening for activity tasks from SWF
 * @returns {ActivityPoller} This Poller so you can chain commands.
 */
ActivityPoller.prototype.stop = function stop() {

  if (!_.isEmpty(this._poller)) {
    // Stop the poller
    this._poller.stop();

    // Remove the instance so config changes can be made between start/stop cycles
    delete this._poller;
  }

  if (!_.isEmpty(this._pollerBackoff)) {
    // Reset the backoff strategy so anything in progress stops
    this._pollerBackoff.reset();

    // Remove the backoff instance
    delete this._pollerBackoff;
  }

  return this; // chainable
};


/** @private */
ActivityPoller.prototype._registerActivities = function _registerActivities(done) {
  var aws = new AWS.SimpleWorkflow(),
      self = this;

  async.each(this._registrations, function (item, next) {
    aws.registerActivityType({
        domain: self.domain,
        name: item.name,
        version: item.version || '1.0.0',
        defaultTaskList: self.options.taskList,
        defaultTaskPriority: self.options.defaultTaskPriority,
        defaultTaskHeartbeatTimeout: self.options.defaultTaskHeartbeatTimeout || 'NONE',
        defaultTaskScheduleToCloseTimeout: self.options.defaultTaskScheduleToCloseTimeout || '90',
        defaultTaskScheduleToStartTimeout: self.options.defaultTaskScheduleToStartTimeout || '30',
        defaultTaskStartToCloseTimeout: self.options.defaultTaskStartToCloseTimeout || '60'
      },
      function () {
        next();
      }
    );
  }, done);

};


ActivityPoller.prototype._onActivityTask = function _onActivityTask(task) {

  // If we are handling request, we can successfuly reset our backoff strategy
  this._pollerBackoff.reset();

  try {

    // Depending on the language of the Decider impl, this can be an Array or Object
    task = new Task(task);

    var name = task.activityType.name,
        version = usherUtil.semverPad(task.activityType.version);

    if (!this._activities[name]) {
      winston.log('debug', 'Activity: %s is not registered for poller: %s', name, this.name, {});
      return task.failed('ActivityTypeVersionNotSupported'); // We do not have an activity registered for this activity name
    }

    var activity = _.find(this._activities[name], function (activity) {
      return semver.satisfies(version, activity.version);
    });

    if (!activity) {
      winston.log('debug', 'No version satisfies activity: %s (%s) for poller: %s', name, version, this.name, {});
      return task.failed('ActivityTypeVersionNotSupported'); // We do not have an activity registered for this activity name
    }

    // Execute the actual activity requested
    activity.execute(task);

  } catch (err) {
    winston.log('error', 'Error occured executing activity: %s for poller: %s due to:', name, this.name, err);
  }

};
