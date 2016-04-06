/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

/* jshint camelcase:false */

'use strict';

var _ = require('lodash');


module.exports = WorkflowState;


var States = {
  SCHEDULED: 'scheduled',
  STARTED: 'started',
  COMPLETED: 'completed',
  CANCELED: 'canceled',
  TIMED_OUT: 'timed-out',
  FAILED: 'failed'
};


function WorkflowState(decisionTask) {
  if (!(this instanceof WorkflowState)) {
    return new WorkflowState(decisionTask);
  }

  this.decisionTask = decisionTask;
  this.states = {};
  this.variables = {};
  this.maxEventId = _.get(decisionTask, 'config.startedEventId') || Number.MAX_VALUE;
  this._resolveState(this.decisionTask.eventList._events);
}

WorkflowState.prototype.failed = function failed(name) {
  var state = this.states[name];
  if (!state) {
    return false;
  }

  if (state.state === States.FAILED || state.state === States.TIMED_OUT || state.state === States.CANCELED) {
    return true;
  }

  return false;
};


WorkflowState.prototype.completed = function completed(name) {
  var state = this.states[name];
  if (!state) {
    return false;
  }

  if (state.state === States.COMPLETED) {
    return true;
  }

  return false;
};


WorkflowState.prototype.outstanding = function outstanding(name) {
  var state = this.states[name];
  if (!state) {
    return false;
  }

  if (state.state === States.SCHEDULED || state.state === States.STARTED) {
    return true;
  }

  return false;
};


WorkflowState.prototype.result = function result(name) {
  var state = this.states[name];
  if (!state) {
    return;
  }

  if (state.state === States.COMPLETED) {
    return state.result;
  }

  return;
};


WorkflowState.prototype.exists = function exists(name) {
  var state = this.states[name];
  if (!state) {
    return false;
  }

  return true;
};


WorkflowState.prototype._resolveState = function _resolveState(events) {
  var self = this;

  function getName(event) {
    var startIndex;

    switch (event.eventType) {
      case 'TimerStarted':
        return event.timerStartedEventAttributes.timerId;
      case 'TimerFired':
        return event.timerFiredEventAttributes.timerId;
      case 'MarkerRecorded':
        return event.markerRecordedEventAttributes.markerName;
      case 'ActivityTaskScheduled':
        return event.activityTaskScheduledEventAttributes.activityId;
      case 'ActivityTaskStarted':
        startIndex = event.activityTaskStartedEventAttributes.scheduledEventId - 1;
        return events[startIndex].activityTaskScheduledEventAttributes.activityId;
      case 'ActivityTaskCompleted':
        startIndex = event.activityTaskCompletedEventAttributes.scheduledEventId - 1;
        return events[startIndex].activityTaskScheduledEventAttributes.activityId;
      case 'ActivityTaskFailed':
        startIndex = event.activityTaskFailedEventAttributes.scheduledEventId - 1;
        return events[startIndex].activityTaskScheduledEventAttributes.activityId;
      case 'ActivityTaskCanceled':
        startIndex = event.activityTaskCanceledEventAttributes.scheduledEventId - 1;
        return events[startIndex].activityTaskScheduledEventAttributes.activityId;
      case 'ActivityTaskCancelRequested':
        return event.activityTaskCancelRequestedEventAttributes.activityId;
      case 'ActivityTaskTimedOut':
        startIndex = event.activityTaskTimedOutEventAttributes.scheduledEventId - 1;
        return events[startIndex].activityTaskScheduledEventAttributes.activityId;
      case 'StartChildWorkflowExecutionInitiated':
        return event.startChildWorkflowExecutionInitiatedEventAttributes.control;
      case 'ChildWorkflowExecutionStarted':
        startIndex = event.childWorkflowExecutionStartedEventAttributes.initiatedEventId - 1;
        return events[startIndex].startChildWorkflowExecutionInitiatedEventAttributes.control;
      case 'ChildWorkflowExecutionCompleted':
        startIndex = event.childWorkflowExecutionCompletedEventAttributes.initiatedEventId - 1;
        return events[startIndex].startChildWorkflowExecutionInitiatedEventAttributes.control;
      case 'ChildWorkflowExecutionFailed':
        startIndex = event.childWorkflowExecutionFailedEventAttributes.initiatedEventId - 1;
        return events[startIndex].startChildWorkflowExecutionInitiatedEventAttributes.control;
      case 'ChildWorkflowExecutionTimedOut':
        startIndex = event.childWorkflowExecutionTimedOutEventAttributes.initiatedEventId - 1;
        return events[startIndex].startChildWorkflowExecutionInitiatedEventAttributes.control;
      case 'ChildWorkflowExecutionTerminated':
        startIndex = event.childWorkflowExecutionTerminatedEventAttributes.initiatedEventId - 1;
        return events[startIndex].startChildWorkflowExecutionInitiatedEventAttributes.control;
      case 'ChildWorkflowExecutionCanceled':
        startIndex = event.childWorkflowExecutionCanceledEventAttributes.initiatedEventId - 1;
        return events[startIndex].startChildWorkflowExecutionInitiatedEventAttributes.control;
    }
  }

  function getState(event) {
    var result;

    switch (event.eventType) {
      case 'TimerStarted':
        return {
          state: States.STARTED
        };
      case 'TimerFired':
        return {
          state: States.COMPLETED
        };
      case 'MarkerRecorded':
        try {
          result = JSON.parse(event.markerRecordedEventAttributes.details);
        } catch (e) {}

        return {
          state: States.COMPLETED,
          result: result
        };
      case 'ActivityTaskScheduled':
      case 'StartChildWorkflowExecutionInitiated':
        return {
          state: States.SCHEDULED
        };
      case 'ActivityTaskStarted':
      case 'ChildWorkflowExecutionStarted':
        return {
          state: States.STARTED
        };
      case 'ActivityTaskCompleted':
        try {
          result = JSON.parse(event.activityTaskCompletedEventAttributes.result);
        } catch (e) {}

        return {
          state: States.COMPLETED,
          result: result
        };
      case 'ActivityTaskFailed':
        return {
          state: States.FAILED,
          reason: event.activityTaskFailedEventAttributes.reason
        };
      case 'ActivityTaskCanceled':
      case 'ActivityTaskCancelRequested':
      case 'ChildWorkflowExecutionTerminated':
      case 'ChildWorkflowExecutionCanceled':
        return {
          state: States.CANCELED
        };
      case 'ActivityTaskTimedOut':
      case 'ChildWorkflowExecutionTimedOut':
        return {
          state: States.TIMED_OUT
        };
      case 'ChildWorkflowExecutionFailed':
        return {
          state: States.FAILED,
          reason: event.childWorkflowExecutionFailedEventAttributes.reason
        };
      case 'ChildWorkflowExecutionCompleted':
        try {
          result = JSON.parse(event.childWorkflowExecutionCompletedEventAttributes.result);
        } catch (e) {}

        return {
          state: States.COMPLETED,
          result: result
        };
    }
  }

  // Ensure that the events are sorted by their ID as we use this as an index for fast lookup
  events = _.sortBy(events, 'eventId');

  // Make sure we only process events up to this specific decision
  events = events.slice(0, this.maxEventId);

  // Walk the events once and determine the final state of everything
  events.forEach(function (event) {
    var name = getName(event);
    if (event.eventType === 'MarkerRecorded' && name.indexOf('var-') === 0) {
      name = name.substr(4, name.length);
      self.variables[name] = _.get(getState(event), 'result.value');
    } else {
      self.states[name] = getState(event);
    }
  });
};
