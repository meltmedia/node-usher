/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var winston = require('winston'),
    util = require('util'),
    events = require('events'),
    os = require('os'),
    _ = require('lodash'),
    swf = require('aws-swf'),
    AWS = require('aws-sdk'),
    sequencify = require('sequencify'),
    Activity = require('./tasks/activity'),
    Decision = require('./tasks/decision'),
    Transform = require('./tasks/transform'),
    Terminate = require('./tasks/terminate'),
    WorkflowExecution = require('./execution');


module.exports = Workflow;

/**
 * Represents a single, named workflow, where all activities and decisions are defined.
 * @constructor
 * @param {string} name - The name of the workflow.
 * @param {string} domain - The AWS SWF domain name to execute this workflow in.
 * @param {string} [tasklist=<name>-tasklist] - The name of the tasklist to listen for tasks on.
 */
function Workflow(name, domain, tasklist) {
  if (!(this instanceof Workflow)) {
    return new Workflow(name, domain, tasklist);
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
  this.tasklist = tasklist;
  this.activityOptions = {};

  /** @private */
  this._tasks = [];
}


// Make Workflow an EventEmitter
util.inherits(Workflow, events.EventEmitter);


/**
 * Set global activity options for the entire workflow
 * @param {Object} options - Custom options to use for all defined activities.
 * @returns {Workflow} This workflow so you can chain commands.
 */
Workflow.prototype.activityDefaults = function activityDefaults(options) {
  if (_.isPlainObject(options)) {
    this.activityOptions = options;
  }

  return this; // chainable
};


/**
 * Add an activity to the workflow
 * @param {string} name - The unique name of the activity.
 * @param {string|Array} [deps] - The names of the dependencies that must be met before this activity can execute.
 * @param {Object} [options] - Custom options for this activity.
 * @returns {Workflow} This workflow so you can chain commands.
 */
Workflow.prototype.activity = function activity(name, deps, options) {
  options = (!_.isArray(deps) && _.isUndefined(options)) ? deps : options;
  deps = (_.isArray(deps)) ? deps : [];
  options = options || {};

  options = _.defaults(options, this.activityOptions);

  var task = new Activity(name, deps, options);
  this._tasks.push(task); // Add the activity

  return this; // chainable
};


/**
 * Add a decision to the workflow
 * @param {string} name - The unique name of the decision.
 * @param {string|Array} [deps] - The names of the dependencies that must be met before this decision can execute.
 * @param {Workflow~decisionLogic} [decisionFn] - The logic for this decision.
 * @returns {Workflow} This workflow so you can chain commands.
 */
Workflow.prototype.decision = function decision(name, deps, decisionFn) {
  decisionFn = (!_.isArray(deps) && _.isUndefined(decisionFn)) ? deps : decisionFn;
  deps = (_.isArray(deps)) ? deps : [];
  decisionFn = decisionFn || function () { return true; };

  var task = new Decision(name, deps, {}, decisionFn);
  this._tasks.push(task); // Add the decision

  return this; // chainable
};

/**
 * The decision logic to execute when evaluating the given named decision
 * @callback Workflow~decisionLogic
 * @param {Object} input - The results of all dependencies for this decision
 * @return {Boolean} Should dependents of this decision execute
 */


/**
 * Add a termination point to the workflow
 * @param {string} name - The unique name that represents this termination point.
 * @param {string|Array} [deps] - The names of the dependencies that must be met before the workflow can terminate.
 * @returns {Workflow} This workflow so you can chain commands.
 */
Workflow.prototype.terminate = function terminate(name, deps) {
  deps = (_.isArray(deps)) ? deps : [];

  var task = new Terminate(name, deps);
  this._tasks.push(task); // Add the terminate task

  return this; // chainable
};


/**
 * Add a transformation to the workflow. Transformations are good for manipulating the results of prior activities into new representations for future dependents.
 * @param {string} name - The unique name of the transformation.
 * @param {string|Array} [deps] - The names of the dependencies that must be met before this decision can execute.
 * @param {Workflow~transformationLogic} [transformFn] - The funtion that will perform the transformation.
 * @returns {Workflow} This workflow so you can chain commands.
 */
Workflow.prototype.transform = function transform(name, deps, transformFn) {
  transformFn = (!_.isArray(deps) && _.isUndefined(transformFn)) ? deps : transformFn;
  deps = (_.isArray(deps)) ? deps : [];

  var task = new Transform(name, deps, {}, transformFn);
  this._tasks.push(task); // Add the transformation

  return this; // chainable
};

/**
 * The tranformation to execute
 * @callback Workflow~transformationLogic
 * @param {Object} input - The results of all dependencies for this transformation
 * @return {*} The transformed input
 */


/**
 * Start listening for decision tasks from SWF
 * @returns {Workflow} This workflow so you can chain commands.
 */
Workflow.prototype.start = function start() {

  // Validate workflow for required dependencies and cycles
  try {
    this._validate();
  } catch (err) {
    winston.log('error', 'Invalid workflow due to the following error: %s', err.message);
    throw err;
  }

  // If we already have a decider, skip setup
  if (!_.isEmpty(this.decider)) {
    return this;
  }

  var config = {
    'domain': this.domain,
    'taskList': {
      'name': this.tasklist || this.name + '-tasklist'
    },
    'identity': this.name + '-' + os.hostname() + '-' + process.pid,
    'maximumPageSize': 100,
    'reverseOrder': false
  };

  this.decider = new swf.Decider(config, new AWS.SimpleWorkflow());

  this.decider.on('decisionTask', this._onDecisionTask.bind(this));

  // Start polling for decision tasks
  this.decider.start();

  return this; // chainable
};


/**
 * Stop listening for decision tasks from SWF
 * @returns {Workflow} This workflow so you can chain commands.
 */
Workflow.prototype.stop = function stop() {

  if (!_.isEmpty(this.decider)) {
    // Stop the poller
    this.decider.stop();

    // Remove the instance so config changes can be made between start/stop cycles
    delete this.decider;
  }

  return this; // chainable
};


/** @private */
Workflow.prototype._validate = function _validate() {
  // Map tasks into sequencify's input format
  var names = [],
      items = {};

  _.each(this._tasks, function (item) {
    names.push(item.name);
    items[item.name] = {
      name: item.name,
      dep: item.deps
    };
  });

  var results = sequencify(items, names);

  // Required dependencies not defined
  if (!_.isEmpty(results.missingTasks)) {
    throw new Error('The workflow is missing tasks: ' + JSON.stringify(results.missingTasks));
  }

  // Recursive dependencies found
  if (!_.isEmpty(results.recursiveDependencies)) {
    throw new Error('The workflow has recursive dependencies: ' + JSON.stringify(results.recursiveDependencies));
  }
};


/** @private */
Workflow.prototype._onDecisionTask = function _onDecisionTask(decisionTask) {
  var context, state;

  winston.log('info', 'We\'ve been asked to make a new decision...');

  try {
    var execution = new WorkflowExecution(this._tasks);
    context = execution.execute(decisionTask);
  } catch (e) {
    // Respond back to SWF failing the workflow
    winston.log('info', '-- workflow execution failed, terminating workflow due to: ', e.stack);
    decisionTask.response.fail('Workflow failed', e, function (err) {
      if (err) {
        winston.log('error', '...an error occured failing workflow due to: %s', JSON.stringify(err));
        return;
      }
      winston.log('warn', '...successfuly failed the workflow.');
    });
    return;
  }

  state = context.state();

  winston.log('info', '-- workflow state:');
  winston.log('info', '\tfailed: ', state.failed);
  winston.log('info', '\tresolved: ', state.resolved);
  winston.log('info', '\tcompleted: ', state.completed);
  winston.log('info', '\tpending: ', state.pending);
  winston.log('info', '\toutstanding: ', state.outstanding);
  winston.log('info', '\tscheduled: ', state.scheduled);

  // If any activities failed, we need to fail the workflow
  if (state.failed.length > 0) {

    winston.log('info', '-- activities failed, terminating workflow');

    // Respond back to SWF failing the workflow
    decisionTask.response.fail('Activities failed', state.failed, function (err) {
      if (err) {
        winston.log('error', '...an error occured failing workflow due to: %s', JSON.stringify(err));
        return;
      }
      winston.log('warn', '...successfuly failed the workflow.');
    });

  } else {

    // Check to see if we are done with the workflow
    if (context.shouldTerminate() ||
        (state.pending.length === 0 && state.scheduled.length === 0 && state.outstanding.length === 0)) {
      winston.log('info', '-- workflow has completed');

      // Stop the workflow
      decisionTask.response.stop({
        result: JSON.stringify(context.results)
      });
    }

    // If no decisions made this round, skip
    if (state.scheduled.length === 0) {
      winston.log('info', '-- no decision can be made this round');

      decisionTask.response.wait();
    }

    // Respond back to SWF with all decisions
    decisionTask.response.respondCompleted(decisionTask.response.decisions, function (err) {
      if (err) {
        winston.log('error', '...an error occured responding with our decision due to: %s', JSON.stringify(err));
        return;
      }
      winston.log('info', '...successfuly responded to SWF with our decision.');
    });

  }
};
