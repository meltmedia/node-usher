/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

/* jshint camelcase:false */

'use strict';

var winston = require('winston'),
    _ = require('lodash'),
    usherUtil = require('../util');


module.exports = Context;


function Context(decisionTask, namespace, localVariables) {
  if (!(this instanceof Context)) {
    return new Context(decisionTask, namespace, localVariables);
  }

  this.namespace = namespace;
  this.decisionTask = decisionTask;
  this.eventList = decisionTask.eventList;
  this.status = {};
  this.results = {};
  this.states = {};
  this.localVariables = localVariables || {};
  this.errorMessages = [];
  this.workflowInput = this.eventList.workflow_input();
}


Context.prototype.setVariable = function (name, value) {
  var markerName = 'var-' + name;
  this.decisionTask.response.add_marker(markerName, JSON.stringify(value));

  // Save the value for future local use
  this.localVariables[name] = value;
};


Context.prototype.getVariables = function () {

  if (_.isEmpty(this.recordedVariables)) {
    var variableLastEventId = {};
    this.recordedVariables = _.reduce(this.eventList._events, function (result, event) {

      if (event.eventType === 'MarkerRecorded' &&
          event.markerRecordedEventAttributes.markerName.indexOf('var-') === 0) {

        var eventId = parseInt(event.eventId, 10),
            markerName = event.markerRecordedEventAttributes.markerName,
            key = markerName.substr(4, markerName.length);

        if (!variableLastEventId[markerName] || eventId > variableLastEventId[markerName]) {
          var details = event.markerRecordedEventAttributes.details,
              value;

          // Try to parse it as JSON
          try {
            value = JSON.parse(details);
          } catch (err) {
            value = details;
          }

          result[key] = value;
          variableLastEventId[markerName] = eventId;
        }
      }
      return result;
    }, {});
  }

  return _.defaults({}, this.localVariables, this.recordedVariables);
};


Context.prototype.saveState = function (task, state) {
  var markerName = this.resolvedTaskName(task) + '-state-marker';
  this.decisionTask.response.add_marker(markerName, JSON.stringify(state));

  // Save the state for future local use
  this.states[markerName] = state;
};


Context.prototype.lastState = function (task) {
  var markerName = this.resolvedTaskName(task) + '-state-marker';

  // The state was updated within this execution
  if (this.states[markerName]) {
    return this.states[markerName];
  }

  // Get saved state from SWF
  var state = this.eventList.get_last_marker_details(markerName);
  if (state) {
    try {
      this.states[markerName] = JSON.parse(state);
    } catch (e) {
      winston.log('warn', 'Unable to parse marker: %s with value:', markerName, state);
    }
  }

  return this.states[markerName];
};


Context.prototype.deferExecution = function (task, id, delay) {
  this.decisionTask.response.start_timer({
    delay: delay || '1'
  }, {
    timerId: this.resolvedTaskName(task) + '-timer-' + id
  });
};


Context.prototype.resumeExecution = function (task, id) {
  var timerName = this.resolvedTaskName(task) + '-timer-' + id;

  // If there is no outstanding timer then execution should continue
  if (!this.eventList.timer_scheduled(timerName)) {
    return true;
  }

  // Only resume execution if the scheduled timer has fired
  return this.eventList.timer_fired(timerName);
};


Context.prototype.resolvedTaskName = function (task) {
  return (this.namespace) ? this.namespace + '-' + task.name : task.name;
};


Context.prototype.setWorkflowInput = function setWorkflowInput(input) {
  this.workflowInput = input;
};


Context.prototype.setTaskStatus = function setTaskStatus(task, mask) {
  this.status[task.name] = mask;

  if (mask.has('failed')) {
    this.errorMessages.push('Task ' + task.name + ' failed.');
  }
};


Context.prototype.isResolved = function isResolved(task) {
  // If the activity has dependencies, make sure they have been resolved befor scheduling
  if (task.deps.length > 0) {

    var missing = _.reject(task.deps, function (dep) {
      return (this.status[dep]) ? this.status[dep].has('resolved') : false;
    }.bind(this));

    if (!_.isEmpty(missing)) {
      // This activity is not yet ready to be scheduled
      return false;
    }
  }

  return true;
};


Context.prototype.didActivityFail = function didActivityFail(task) {
  return this.eventList.is_activity_canceled(this.resolvedTaskName(task)) ||
         this.eventList.timed_out(this.resolvedTaskName(task)) ||
         this.eventList.failed(this.resolvedTaskName(task));
};


Context.prototype.didActivityComplete = function didActivityComplete(task) {
  return this.eventList.completed(this.resolvedTaskName(task));
};


Context.prototype.isActivityOutstanding = function isActivityOutstanding(task) {
  return this.eventList.scheduled(this.resolvedTaskName(task));
};


Context.prototype.didChildWorkflowFail = function didChildWorkflowFail(task) {

  var control = this.resolvedTaskName(task),
      initiatedEventId, initiatedEvent;
  return this.eventList._events.some(function (evt) {
     if (evt.eventType === 'StartChildWorkflowExecutionFailed') {
        initiatedEventId = evt.startChildWorkflowExecutionFailedEventAttributes.initiatedEventId;
        initiatedEvent = this.eventList.eventById(initiatedEventId);
        if (initiatedEvent.startChildWorkflowExecutionInitiatedEventAttributes.control === control) {
           return true;
        }
     } else if (evt.eventType === 'ChildWorkflowExecutionTimedOut') {
        initiatedEventId = evt.childWorkflowExecutionTimedOutEventAttributes.initiatedEventId;
        initiatedEvent = this.eventList.eventById(initiatedEventId);
        if (initiatedEvent.startChildWorkflowExecutionInitiatedEventAttributes.control === control) {
           return true;
        }
     } else if (evt.eventType === 'ChildWorkflowExecutionFailed') {
        initiatedEventId = evt.childWorkflowExecutionFailedEventAttributes.initiatedEventId;
        initiatedEvent = this.eventList.eventById(initiatedEventId);
        if (initiatedEvent.startChildWorkflowExecutionInitiatedEventAttributes.control === control) {
           return true;
        }
     }
  }, this);
};


Context.prototype.didChildWorkflowComplete = function didChildWorkflowComplete(task) {
  return this.eventList.childworkflow_completed(this.resolvedTaskName(task));
};


Context.prototype.isChildWorkflowOutstanding = function isChildWorkflowOutstanding(task) {
  return this.eventList.childworkflow_scheduled(this.resolvedTaskName(task));
};


Context.prototype.addResult = function addResult(task, value) {
  this.results[task.name] = value;
};


Context.prototype.addActivityResult = function addActivityResult(task) {
  this.results[task.name] = this.eventList.results(this.resolvedTaskName(task));
};


Context.prototype.addChildWorkflowResult = function addChildWorkflowResult(task) {
  this.results[task.name] = this.eventList.childworkflow_results(this.resolvedTaskName(task));
};


Context.prototype.scheduleActivity = function scheduleActivity(task) {

  var config = usherUtil.activityConfig(task.name, task.options.version, this.input(task), task.options);

  // Schedule actual task
  winston.log('debug', 'Scheduling activity: %s - %s', this.resolvedTaskName(task), JSON.stringify(config));

  this.decisionTask.response.schedule({ name: this.resolvedTaskName(task), input: config.input }, config);

};


Context.prototype.scheduleChildWorkflow = function scheduleChildWorkflow(task) {

  var config = usherUtil.workflowConfig(task.workflowName, task.workflowVersion, this.input(task), task.options);

  // Schedule actual task
  winston.log('debug', 'Scheduling child workflow: %s - %s', this.resolvedTaskName(task), JSON.stringify(config));

  // The aws-swf lib breaks apart some config and options here, even though they are ultimatly merged.
  // We only produce one config and send them both in to aws-swf that will produce a valid merged object.
  this.decisionTask.response.start_childworkflow({ name: this.resolvedTaskName(task), input: config.input }, config);

};


Context.prototype.input = function input(task) {
  var self = this;

  var taskInput = {
    '_input': this.workflowInput,
    '_state': this.lastState(task),
    '_variables': this.getVariables()
  };

  _.forEach(task.deps, function (key) {
    taskInput[key] = this.results[key];
  }.bind(this));

  // If a input tranform was defined, let it define the input for the activity
  if (task.options && _.isFunction(task.options.transform)) {
    taskInput = task.options.transform.call(task, taskInput, self);
  }

  return taskInput;
};


Context.prototype.done = function done() {
  return (
    this.terminated() ||
    this.failed() ||
    this.success()
  );
};


Context.prototype.terminated = function terminated() {
  return (
    _.some(this.status, function (mask) {
      return mask.has('terminate');
    })
  );
};


Context.prototype.success = function success() {
  return (
    _.every(this.status, function (mask) {
      return mask.has('complete');
    })
  );
};


Context.prototype.failed = function failed() {
  return (
    _.some(this.status, function (mask) {
      return mask.has('failed');
    })
  );
};

Context.prototype.currentStatus = function currentStatus() {
  return _.reduce(this.status, function (result, mask, id) {
    result[id] = mask.value();
    return result;
  }, {});
};


/**
 * Util Functions
 */
