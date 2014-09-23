/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    events = require('events'),
    _ = require('lodash'),
    Fragment = require('./decider/fragment'),
    WorkflowPoller = require('./decider/poller'),
    ActivityPoller = require('./activity/poller');

/**
 * Manages workflows
 * @constructor
 */
function Usher() {
  if (!(this instanceof Usher)) {
    return new Usher();
  }

  events.EventEmitter.call(this);

  this.workflows = {};
  this.fragments = {};
  this.pollers = {};
}


// Make Usher an EventEmitter
util.inherits(Usher, events.EventEmitter);


/**
 * Create or retrieve a workflow
 * @param {string} name - The name of the workflow.
 * @param {string} domain - The AWS SWF domain name to execute this workflow in.
 * @param {object} [options] - Additional SWF options used when creating and executing this workflow
 *                             (taskList, tagList, childPolicy, executionStartToCloseTimeout, taskStartToCloseTimeout)
 * @returns {DecisionPoller} - A workflow poller where specific versions of a workflow can be defined
 */
Usher.prototype.workflow = function workflow(name, domain, options) {

  var id = name + '-' + domain,
      result = this.workflows[id];

  // If we are defining a new workflow
  if (_.isUndefined(result)) {
    // New poller
    result = new WorkflowPoller(name, domain, options);
    this.workflows[id] = result;
  }

  return result;
};


/**
 * Create or retrieve a workflow fragment
 * @param {string} name - The name of the fragment.
 * @returns {Fragment} - A workflow fragment instance
 */
Usher.prototype.fragment = function fragment(name) {

  var result = this.fragments[name];

  // If we are defining a new workflow
  if (_.isUndefined(result)) {
    // New workflow
    result = new Fragment(name);
    this.fragments[name] = result;
  }

  return result;
};


/**
 * Create or retrieve a activity poller
 * @param {string} name - The name of the poller.
 * @param {string} domain - The AWS SWF domain name to execute the pollers activities in.
 * @param {object} [options] - Additional SWF options used when polling for activities
 *                             (taskList=<name>-tasklist)
 * @returns {ActivityPoller} - A activity poller instance where specific activities can be defined
 */
Usher.prototype.activities = function activities(name, domain, options) {

  var id = name + '-' + domain,
      result = this.pollers[id];

  // If we are defining a new workflow
  if (_.isUndefined(result)) {
    // New poller
    result = new ActivityPoller(name, domain, options);
    this.pollers[id] = result;
  }

  return result;
};


module.exports = new Usher();
