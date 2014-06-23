/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var winston = require('winston'),
    util = require('util'),
    os = require('os'),
    _ = require('lodash'),
    swf = require('aws-swf'),
    AWS = require('aws-sdk'),
    sequencify = require('sequencify'),
    Context = require('./context'),
    Fragment = require('./fragment'),
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

  Fragment.call(this, name);

  if (!_.isString(domain)) {
    throw new Error('A `domain` is required');
  }

  this.domain = domain;
  this.tasklist = tasklist;
}


// Make Workflow an extention of Fragment
util.inherits(Workflow, Fragment);


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

  _.each(this.tasks(), function (item) {
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
  var context,
      state,
      self = this;

  winston.log('debug', 'Handling new decision task for workflow: %s', this.name);

  try {
    var execution = new WorkflowExecution(this.tasks());
    context = new Context(decisionTask);
    execution.execute(context);
  } catch (e) {
    // Respond back to SWF failing the workflow
    winston.log('error', 'An problem occured in the execution of workflow: %s, failing due to: ', this.name, e.stack);
    decisionTask.response.fail('Workflow failed', e, function (err) {
      if (err) {
        winston.log('error', 'Unable to mark workflow: %s as failed due to: %s', self.name, JSON.stringify(err));
        return;
      }
    });
    return;
  }

  // If any activities failed, we need to fail the workflow
  if (context.failWorkflow) {
    winston.log('warn', 'One of more activities failed in workflow: %s, marking workflow as failed', this.name);

    // Respond back to SWF failing the workflow
    decisionTask.response.fail('Activities failed', state.failed, function (err) {
      if (err) {
        winston.log('error', 'Unable to mark workflow: %s as failed due to: %s', self.name, JSON.stringify(err));
        return;
      }
    });

  } else {

    // Check to see if we are done with the workflow
    if (context.done()) {
      winston.log('info', 'Workflow: %s has completed successfuly', this.name);

      // Stop the workflow
      decisionTask.response.stop({
        result: JSON.stringify(context.results)
      });
    }

    // If no decisions made this round, skip
    if (!decisionTask.response.decisions) {
      winston.log('debug', 'No decision can be made this round for workflow: %s', this.name);
      decisionTask.response.wait();
    }

    // Respond back to SWF with all decisions
    decisionTask.response.respondCompleted(decisionTask.response.decisions, function (err) {
      if (err) {
        winston.log('error', 'Unable to respond to workflow: %s with decisions due to: %s', self.name, JSON.stringify(err));
        return;
      }
    });
  }
};
