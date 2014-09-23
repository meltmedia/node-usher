/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var winston = require('winston');


module.exports = ActivityTask;


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
}

ActivityTask.prototype.success = function (output, cb) {
  var self = this;

  cb = cb || function () {};

  winston.log('debug', 'Activity task: %s completed successfuly', this.activityType.name);

  this._task.respondCompleted(output, function (err) {
    if (err) {
      return winston.log('warn', 'Unable to complete activity task: %s due to: %s', self.activityId, err);
    }
    winston.log('verbose', 'Completed activity task: %s', self.activityId);
    cb(err);
  });
};

ActivityTask.prototype.failed = function (name, err, retriable, cb) {
  var self = this;

  cb = cb || function () {};

  winston.log('debug', 'Activity task: %s failed, due to: %s', this.activityType.name, name);

  var message = {
    name: name,
    retriable: retriable || false,
    message: err.message || err
  };

  this._task.respondFailed(name, JSON.stringify(message), function (e) {
    if (e) {
      return winston.log('warn', 'Unable to fail activity task: %s due to:', self.activityId, e);
    }
    winston.log('warn', 'Failed activity task: %s due to:', self.activityId, message);
    cb(e);
  });
};
