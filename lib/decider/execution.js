/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var async = require('async'),
    winston = require('winston'),
    STATUS = require('./tasks/status');


module.exports = WorkflowExecution;


function WorkflowExecution(tasks) {
  if (!(this instanceof WorkflowExecution)) {
    return new WorkflowExecution(tasks);
  }

  this.tasks = tasks;
}


WorkflowExecution.prototype.execute = function execute(context, done) {
  done = done || function () {};

  async.eachSeries(this.tasks, function (task, next) {
    // Check to see if the task's dependencies have been resolved first
    if (!context.isResolved(task)) {
      var mask = STATUS.mask('pending');
      context.setTaskStatus(task, mask);
      return next(null, { name: task.name, mask: mask });
    }

    // Execute this task, updating the context for future tasks to utilize
    task.execute(context, function (mask) {
      winston.log('debug', 'Task %s completed with status: ', task.name, mask._value);

      // Update the status
      context.setTaskStatus(task, mask);

      next(null, { name: task.name, mask: mask });
    });
  }, function (err, results) {
    done(err, results);
  });
};
