/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var winston = require('winston');


module.exports = ActivityTask;


/**
 * The context for the execution of the activity
 * @constructor
 * @param {string} task - The raw `aws-swf` activity task
 */
function ActivityTask(task) {
  if (!(this instanceof ActivityTask)) {
    return new ActivityTask(task);
  }

  this.input = {};

  if (task.config.input) {
    this.input = JSON.parse(task.config.input);
  }

  // Depending on the language of the Decider impl, this can be an Array or Object
  // This is a big assumption, maybe make this configurable
  if (Array.isArray(this.input)) {
    this.input = this.input[0];
  }

  this.activityId = task.config.activityId;
  this.activityType = task.config.activityType;
  this.startedEventId = task.config.startedEventId;
  this.taskToken = task.config.taskToken;
  this.workflowExecution = task.config.workflowExecution;

  this._task = task;

  // Register a hearbeat callback every 10 seconds
  this.hearbeatCount = 0;
  this.heartbeatTimer = setInterval(function () {
    var self = this;
    self._task.recordHeartbeat(
      { activity: self.activityType.name, id: self.activityId, count: self.hearbeatCount++ },
      function (err) {
        if (err) {
          winston.log('debug', 'Heartbead failed for task: %s (%s) due to:', self.activityType.name, self.activityId, err);
        }
      });
  }.bind(this), 10000);
}


/**
 * Execute once the activity has completed successfuly
 *
 * @param {object} output - The results of the activity, if any
 * @param {function} [cb] - Callback to run once we have successfuly informed SWF of our status
 */
ActivityTask.prototype.success = function (output, cb) {
  var self = this;

  cb = cb || function () {};

  winston.log('debug', 'Activity task: %s (%s) completed successfuly', this.activityType.name, self.activityId);

  // Stop heartbeat timer
  clearInterval(self.heartbeatTimer);

  this._task.respondCompleted(output, function (err) {
    if (err) {
      return winston.log('warn', 'Unable to complete activity task: %s (%s) due to: %s', self.activityType.name, self.activityId, err);
    }
    winston.log('verbose', 'Completed activity task: %s (%s)', self.activityType.name, self.activityId);
    cb(err);
  });
};


/**
 * Execute if the activity failed
 *
 * @param {string} name - A unique name for the failure
 * @param {object} [err] - The reason for the failure
 * @param {boolean} [retriable] - A hint to if the activity should be attempted again
 * @param {function} [cb] - Callback to run once we have successfuly informed SWF of our status
 */
ActivityTask.prototype.failed = function (name, err, retriable, cb) {
  var self = this;

  cb = cb || function () {};

  winston.log('debug', 'Activity task: %s (%s) failed, due to: %s', this.activityType.name, this.activityId, name);

  // Stop heartbeat timer
  clearInterval(self.heartbeatTimer);

  var message = {
    name: name,
    retriable: retriable || false,
    message: err.message || err
  };

  this._task.respondFailed(name, JSON.stringify(message), function (e) {
    if (e) {
      return winston.log('warn', 'Unable to fail activity task: %s (%s) due to:', self.activityType.name, self.activityId, e);
    }
    winston.log('warn', 'Failed activity task: %s (%s) due to:', self.activityType.name, self.activityId, message);
    cb(e);
  });
};
