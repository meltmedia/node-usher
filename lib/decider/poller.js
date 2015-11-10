/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var winston = require('winston'),
    os = require('os'),
    _ = require('lodash'),
    async = require('async'),
    swf = require('aws-swf'),
    AWS = require('aws-sdk'),
    backoff = require('backoff'),
    semver = require('semver'),
    usherUtil = require('../util'),
    WorkflowVersion = require('./version');


module.exports = DecisionPoller;

/**
 * Represents a single, named decision poller, where all workflow versions can be created. Tasks will automaticly be
 * routed to the first workflow that satisfies the version requested. If no valid workflow is found, the task will
 * be marked as a failure.
 *
 * @constructor
 * @param {string} name - The name of the workflow.
 * @param {string} domain - The AWS SWF domain name to use when listening for decision tasks.
 * @param {object} [options] - Additional SWF options used when creating and executing this workflow
 *                             (taskList, tagList, childPolicy, executionStartToCloseTimeout, taskStartToCloseTimeout)
 */
function DecisionPoller(name, domain, options) {
  if (!(this instanceof DecisionPoller)) {
    return new DecisionPoller(name, domain, options);
  }

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
  this._workflows = [];
  this._poller = undefined;
}


/**
 * Get or create a new WorkflowVersion to handle the given version
 * @param {string} version - Version(s) this workflow can handle (conforms to v2.0 of http://semver.org)
 * @returns {WorkflowVersion} This workflow version so you can configure the actual decider.
 */
DecisionPoller.prototype.version = function version(ver) {

  var workflow = _.find(this._workflows, { version: ver });

  if (!workflow) {
    workflow = new WorkflowVersion(this.name, ver, this.domain, this.options);
    this._workflows.push(workflow);

    // Sort the workflows by their version so we can pick the best first match
    this._workflows.sort(function (w1, w2) {
      return semver.compare(w1.version, w2.version);
    });
  }

  return workflow;
};


/**
 * Register a SWF Workflow
 * @param {string} name - The name of the workflow.
 * @param {string} version - The AWS version of the workflow being registered.
 * @returns {DecisionPoller} This Poller so you can chain commands.
 */
DecisionPoller.prototype.register = function register(name, version) {
  this._registrations.push({ name: name, version: version });
  return this;
};


/**
 * Execute the proper workflow version
 * @param {Object} input - Input to the workflow
 * @param {string} version - Version of the workflow to execute (conforms to v2.0 of http://semver.org)
 * @param {Object} [tags] - Tags to mark the workflow with
 * @param {Function} [cb] - Callback when done
 * @returns {Workflow} This workflow version so you can configure the actual decider.
 */
DecisionPoller.prototype.execute = function execute(input, version, tags, cb) {

  if (!input && !version) {
    throw new Error('Missing paramaters for workflow execution: input and version required');
  }

  cb = cb || (_.isFunction(tags) ? tags : function () {});
  tags = _.isFunction(tags) ? [] : (tags || []);

  var workflow = _.find(this._workflows, function (item) {
    return semver.satisfies(version, item.version);
  });

  if (!workflow) {
    cb(new Error('Unable to find a registered workflow that satisfies version: ' + version));
    return this; // Chainable
  }

  // Execute the workflow version
  workflow.execute(input, tags, cb);

  return this; // Chainable
};


/**
 * Start listening for decision tasks from SWF
 *
 * @returns {DecisionPoller} This workflow poller
 */
DecisionPoller.prototype.start = function start() {

  var self = this;

  // If we already have a poller, skip setup
  if (!_.isEmpty(this._poller)) {
    return;
  }

  // Before starting, ensure each workflow version is valid
  var valid = _.every(this._workflows, function (workflow) {
    try {
      workflow.validate();
      return true;
    } catch (err) {
      winston.log('error', 'The workflow: %s for version: %s is invalid due to:', workflow.name, workflow.version, err);
      return false;
    }
  });

  if (!valid) {
    winston.log('error', 'Unable to start workflow: %s', this.name);
    return;
  }

  var config = {
    'domain': this.domain,
    'taskList': this.options.taskList,
    'identity': this.name + '-' + os.hostname() + '-' + process.pid,
    'maximumPageSize': 100,
    'reverseOrder': false
  };

  this._poller = new swf.Decider(config, new AWS.SimpleWorkflow());

  this._poller.on('decisionTask', this._onDecisionTask.bind(this));


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
    winston.log('silly', 'Polling for decision tasks in poller: %s ...', self.name);
  });

  this._poller.on('error', function (err) {
    winston.log('error', 'An error occured in poller: %s due to: ', self.name, err);
    // Attempt to start polling again
    self._pollerBackoff.backoff();
  }.bind(this));


  winston.log('debug', 'Registering %s workflows', this._registrations.length);
  this._registerWorkflows(function () {
    if (!_.isEmpty(self._poller)) {
      // Start the poller
      winston.log('info', 'Starting poller: %s', self.name);
      self._poller.start();
    }
  });

  return this; // chainable
};


/**
 * Stop listening for decision tasks from SWF
 *
 * @returns {DecisionPoller} This workflow poller
 */
DecisionPoller.prototype.stop = function stop() {

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
DecisionPoller.prototype._registerWorkflows = function _registerWorkflows(done) {
  var aws = new AWS.SimpleWorkflow(),
      self = this;

  async.each(this._registrations, function (item, next) {
    aws.registerWorkflowType({
        domain: self.domain,
        name: item.name,
        version: item.version || '1.0.0',
        defaultTaskList: self.options.taskList,
        defaultExecutionStartToCloseTimeout: self.options.defaultExecutionStartToCloseTimeout,
        defaultTaskStartToCloseTimeout: self.options.defaultTaskStartToCloseTimeout,
        defaultTaskPriority: self.options.defaultTaskPriority,
        defaultChildPolicy: self.options.defaultChildPolicy
      },
      function () {
        next();
      }
    );
  }, done);
};


DecisionPoller.prototype._onDecisionTask = function _onDecisionTask(task) {

  // If we are handling request, we can successfuly reset our backoff strategy
  this._pollerBackoff.reset();

  var name = task.config.workflowType.name,
      version = usherUtil.semverPad(task.config.workflowType.version);

  // Lookup workflow...
  var workflow = _.find(this._workflows, function (item) {
    return semver.satisfies(version, item.version);
  });

  // Fail the workflow if we can not find a workflow that satisfies the requested version
  if (!workflow) {
    var message = {
      name: 'NoValidVersionFound',
      retriable: false,
      message: 'No workflow satisfies version: ' + version
    };

    task.response.fail(message.name, message, function (err) {
      if (err) {
        winston.log('error', 'Unable to mark workflow: %s as failed due to: %s', name, JSON.stringify(err));
        return;
      }
    });
    return;
  }

  // If we get here we have a valid workflow so we let it do it's thing
  workflow._handleTask(task);

};
