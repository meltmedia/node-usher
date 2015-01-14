/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

/* jshint camelcase:false */

'use strict';

var winston = require('winston'),
    util = require('util'),
    _ = require('lodash'),
    swf = require('aws-swf'),
    AWS = require('aws-sdk'),
    sequencify = require('sequencify'),
    usherUtil = require('../util'),
    Context = require('./context'),
    Fragment = require('./fragment'),
    WorkflowExecution = require('./execution');


module.exports = WorkflowVersion;

/**
 * Represents a single, named workflow, where all activities and decisions are defined.
 * @constructor
 * @extends {Fragment}
 * @param {string} name - The name of the workflow.
 * @param {string} version - Version(s) this workflow can handle (conforms to v2.0 of http://semver.org)
 * @param {string} domain - The AWS SWF domain name to execute this workflow in.
 * @param {object} [options] - Additional SWF options used when creating and executing this workflow
 *                             (taskList, tagList, childPolicy, executionStartToCloseTimeout, taskStartToCloseTimeout)
 */
function WorkflowVersion(name, version, domain, options) {
  if (!(this instanceof WorkflowVersion)) {
    return new WorkflowVersion(name, version, domain, options);
  }

  Fragment.call(this, name);

  if (!_.isString(domain)) {
    throw new Error('A `domain` is required');
  }

  this.version = version;
  this.domain = domain;
  this.options = options || {};
}


// Make Workflow an extention of Fragment
util.inherits(WorkflowVersion, Fragment);


/**
 * Execute a new run of this workflow
 * @returns {WorkflowVersion} This workflow so you can chain commands.
 */
WorkflowVersion.prototype.execute = function execute(input, cb) {

  // Callback is optional
  cb = cb || function () {};

  var config = usherUtil.workflowConfig(this.name, this.version, input, this.options);

  // The domain is not always needed so it's not set by the workflow config
  config.domain = this.domain;

  var workflow = new swf.Workflow(config, new AWS.SimpleWorkflow());
  var workflowExecution = workflow.start({ input: JSON.stringify(input) }, function (err, runId) {
    if (err) {
      return cb(err);
    }
    cb(null, runId, workflowExecution.workflowId);
  });

  return this; // chainable
};


/**
 * Validate this workflow
 * @returns {WorkflowVersion} This workflow version so you can chain commands.
 */
WorkflowVersion.prototype.validate = function validate() {
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
WorkflowVersion.prototype._handleTask = function _handleTask(decisionTask) {
  var context,
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
  if (context.failed()) {
    winston.log('warn', 'One of more activities failed in workflow: %s, marking workflow as failed', this.name);

    // Respond back to SWF failing the workflow
    decisionTask.response.fail('Activities failed', { failures: context.errorMessages }, function (err) {
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
      // Record our state when we can't make a decision to help in debugging
      decisionTask.response.add_marker('current-state', JSON.stringify(context.currentStatus()));
      // decisionTask.response.wait();
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
