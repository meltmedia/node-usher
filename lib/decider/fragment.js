/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    events = require('events'),
    _ = require('lodash'),
    sequencify = require('sequencify'),
    Activity = require('./tasks/activity'),
    ChildWorkflow = require('./tasks/child'),
    Loop = require('./tasks/loop'),
    Accumulator = require('./tasks/accumulator'),
    WhileLoop = require('./tasks/while-loop'),
    Decision = require('./tasks/decision'),
    Transform = require('./tasks/transform'),
    Result = require('./tasks/result'),
    Variable = require('./tasks/variable'),
    Terminate = require('./tasks/terminate');


module.exports = Fragment;

/**
 * Represents a single, named workflow, where all activities and decisions are defined.
 * @constructor
 * @param {string} name - The name of the workflow.
 * @param {string} domain - The AWS SWF domain name to execute this workflow in.
 * @param {string} [tasklist=<name>-tasklist] - The name of the tasklist to listen for tasks on.
 */
function Fragment(name) {
  if (!(this instanceof Fragment)) {
    return new Fragment(name);
  }

  events.EventEmitter.call(this);

  if (!_.isString(name)) {
    throw new Error('A `name` is required');
  }

  this.name = name;
  this.activityOptions = {};

  /** @private */
  this._tasks = [];
  this._sequencedTasks = [];
}


// Make Fragment an EventEmitter
util.inherits(Fragment, events.EventEmitter);


/**
 * Get the defined tasks for the fragment
 * @returns {Array} An array of defined tasks
 */
Fragment.prototype.tasks = function tasks() {
  return this._tasks;
};


/**
 * Get the defined tasks for the fragment in execution order
 * @returns {Array} An array of defined tasks
 */
Fragment.prototype.sequencedTasks = function sequencedTasks() {
  if (this._sequencedTasks && this._sequencedTasks.length > 0) {
    return this._sequencedTasks;
  }

  // Map tasks into sequencify's input format
  var names = [],
      items = {};

  _.each(this.tasks(), function (item) {
    names.push(item.name);
    items[item.name] = {
      name: item.name,
      dep: item.deps,
      task: item
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

  // Cache sequenced tasks
  this._sequencedTasks = _.map(results.sequence, function (item) {
    return items[item].task;
  });

  return this._sequencedTasks;
};


/**
 * Set global activity options for the entire workflow
 * @param {Object} options - Custom options to use for all defined activities.
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.activityDefaults = function activityDefaults(options) {
  if (_.isPlainObject(options)) {
    this.activityOptions = options;
  }

  return this; // chainable
};


/**
 * Add an activity to the workflow
 * @param {string} name - The unique name of the activity.
 * @param {Array} [deps] - The names of the dependencies that must be met before this activity can execute.
 * @param {Object} [options] - Custom options for this activity.
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.activity = function activity(name, deps, options) {
  if (!options && !_.isArray(deps)) {
    options = deps;
    deps = undefined;
  }
  deps = deps || [];
  options = options || {};

  options = _.defaults(options, this.activityOptions);

  var task = new Activity(name, deps, options);
  this._tasks.push(task); // Add the activity
  this._sequencedTasks = null;

  return this; // chainable
};


/**
 * Add an child workflow execution to the workflow
 * @param {string} name - The unique name of the child workflow.
 * @param {Array} [deps] - The names of the dependencies that must be met before this activity can execute.
 * @param {string} workflowName - The name of the workflow to execute.
 * @param {string} workflowVersion - The version of the workflow to execute.
 * @param {Object} [options] - Custom options for this activity.
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.child = function child(name, deps, workflowName, workflowVersion, options) {
  if (!options && !_.isArray(deps)) {
    options = workflowVersion;
    workflowVersion = workflowName;
    workflowName = deps;
    deps = undefined;
  }
  deps = deps || [];
  options = options || {};

  var task = new ChildWorkflow(name, deps, workflowName, workflowVersion, options);
  this._tasks.push(task); // Add the child workflow
  this._sequencedTasks = null;

  return this; // chainable
};


/**
 * Add a looping workflow execution to the workflow
 *
 * The loop executes in batches to help alleviate rate limit exceptions.
 * The number of items to proccess per batch and the delay between batches are both configurable.
 *
 * @param {string} name - The unique name of the loop fragment.
 * @param {Array} [deps] - The names of the dependencies that must be met before this activity can execute.
 * @param {Fragment} fragment - The workflow fragment to loop over. Generated by `usher.fragment()`
 * @param {Function} loopFn - A function given the taks's input that returns an array. For every item in the Array an
 *                            execution of the `fragment` workflow will execute.
 * @param {Object} [options] - Custom options for this activity. [itemsPerBatch, batchDelay]
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.loop = function loop(name, deps, fragment, loopFn, options) {
  if (!options && !_.isArray(deps)) {
    options = loopFn;
    loopFn = fragment;
    fragment = deps;
    deps = undefined;
  }
  deps = deps || [];

  var task = new Loop(name, deps, fragment, loopFn, options);
  this._tasks.push(task); // Add the loop
  this._sequencedTasks = null;

  return this; // chainable
};


/**
 * Add a while loop workflow execution to the workflow
 *
 * The loop executes until the `doneFn` returns a truthy value
 *
 * @param {string} name - The unique name of the while loop fragment.
 * @param {Array} [deps] - The names of the dependencies that must be met before this activity can execute.
 * @param {Fragment} fragment - The workflow fragment to loop over. Generated by `usher.fragment()`
 * @param {Function} doneFn - Indicates when the loop is complete by returning a truthy value.
 * @param {Object} [options] - Custom options for this activity.
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.whileLoop = function whileLoop(name, deps, fragment, doneFn, options) {
  if (!options && !_.isArray(deps)) {
    options = doneFn;
    doneFn = fragment;
    fragment = deps;
    deps = undefined;
  }
  deps = deps || [];

  var task = new WhileLoop(name, deps, fragment, doneFn, options);
  this._tasks.push(task); // Add the while loop
  this._sequencedTasks = null;

  return this; // chainable
};


/**
 * Add a accumulator execution to the workflow
 *
 * The accumulator executes a fragment until the `doneFn` returns a truthy value, taking the results
 * of each iteration and making them available to any dependents
 *
 * @param {string} name - The unique name of the accumulator fragment.
 * @param {Array} [deps] - The names of the dependencies that must be met before this activity can execute.
 * @param {Fragment} fragment - The workflow fragment to iterate over. Generated by `usher.fragment()`
 * @param {Function} doneFn - Indicates when the accumulator is complete by returning a truthy value.
 * @param {Object} [options] - Custom options for this activity.
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.accumulator = function accumulator(name, deps, fragment, doneFn, options) {
  if (!options && !_.isArray(deps)) {
    options = doneFn;
    doneFn = fragment;
    fragment = deps;
    deps = undefined;
  }
  deps = deps || [];

  var task = new Accumulator(name, deps, fragment, doneFn, options);
  this._tasks.push(task); // Add the while loop
  this._sequencedTasks = null;

  return this; // chainable
};


/**
 * Add a decision to the workflow
 * @param {string} name - The unique name of the decision.
 * @param {Array} [deps] - The names of the dependencies that must be met before this decision can execute.
 * @param {Fragment~decisionLogic} decisionFn - The logic for this decision.
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.decision = function decision(name, deps, decisionFn) {
  if (!decisionFn && !_.isArray(deps)) {
    decisionFn = deps;
    deps = undefined;
  }
  deps = deps || [];
  decisionFn = decisionFn || function () { return true; };

  var task = new Decision(name, deps, decisionFn);
  this._tasks.push(task); // Add the decision
  this._sequencedTasks = null;

  return this; // chainable
};

/**
 * The decision logic to execute when evaluating the given named decision
 * @callback Fragment~decisionLogic
 * @param {Object} input - The results of all dependencies for this decision
 * @return {Boolean} Should dependents of this decision execute
 */


/**
 * Add a termination point to the workflow
 * @param {string} name - The unique name that represents this termination point.
 * @param {Array} [deps] - The names of the dependencies that must be met before the workflow can terminate.
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.terminate = function terminate(name, deps) {
  deps = deps || [];

  var task = new Terminate(name, deps);
  this._tasks.push(task); // Add the terminate task
  this._sequencedTasks = null;

  return this; // chainable
};


/**
 * Add a transformation to the workflow. Transformations are good for manipulating the results of prior activities into new representations for future dependents.
 * @param {string} name - The unique name of the transformation.
 * @param {Array} [deps] - The names of the dependencies that must be met before this decision can execute.
 * @param {Fragment~transformationLogic} [transformFn] - The funtion that will perform the transformation.
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.transform = function transform(name, deps, transformFn) {
  if (!transformFn && !_.isArray(deps)) {
    transformFn = deps;
    deps = undefined;
  }
  deps = deps || [];
  transformFn = transformFn || function (input) { return input; };

  var task = new Transform(name, deps, transformFn);
  this._tasks.push(task); // Add the transformation
  this._sequencedTasks = null;

  return this; // chainable
};

/**
 * The tranformation to execute
 * @callback Fragment~transformationLogic
 * @param {Object} input - The results of all dependencies for this transformation
 * @return {*} The transformed input
 */


/**
 * Add a result transformation to the workflow. This sets the fragments results based on the `transformFn`
 * @param {string} name - The unique name of the result task.
 * @param {Array} [deps] - The names of the dependencies that must be met before this decision can execute.
 * @param {Fragment~transformationLogic} [transformFn] - The funtion that will perform the transformation.
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.result = function result(name, deps, transformFn) {
  if (!transformFn && !_.isArray(deps)) {
    transformFn = deps;
    deps = undefined;
  }
  deps = deps || [];
  transformFn = transformFn || function (input) { return input; };

  var task = new Result(name, deps, transformFn);
  this._tasks.push(task); // Add the transformation
  this._sequencedTasks = null;

  return this; // chainable
};


/**
 * Set an variable accessable to all future scheduled activities
 * @param {string} name - The unique name of the variable.
 * @param {Array} [deps] - The names of the dependencies that must be met before this variable can be set.
 * @param {Fragment~variableValueFunction} [valueFn] - The funtion that will calculate the variable name.
 * @returns {Fragment} This workflow so you can chain commands.
 */
Fragment.prototype.variable = function variable(name, deps, valueFn) {
  if (!valueFn && !_.isArray(deps)) {
    valueFn = deps;
    deps = undefined;
  }
  deps = deps || [];
  valueFn = valueFn || function (input) { return input; };

  var task = new Variable(name, deps, valueFn);
  this._tasks.push(task); // Add the variable task
  this._sequencedTasks = null;

  return this; // chainable
};

/**
 * A function to determine the value of the variable
 * @callback Fragment~variableValueFunction
 * @param {Object} input - The results of all dependencies for this variable
 * @return {*} The variable value
 */
