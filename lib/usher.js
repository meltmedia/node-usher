/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    events = require('events'),
    _ = require('lodash'),
    Fragment = require('./fragment'),
    Workflow = require('./workflow');

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
}


// Make Usher an EventEmitter
util.inherits(Usher, events.EventEmitter);


/**
 * Create or retrieve a workflow
 * @param {string} name - The name of the workflow.
 * @param {string} [domain] - The AWS SWF domain name to execute this workflow in.
 * @param {string} [tasklist=<name>-tasklist] - The name of the tasklist to listen for tasks on.
 * @returns {Workflow} - A workflow instance
 */
Usher.prototype.workflow = function workflow(name, domain, tasklist) {

  var result = this.workflows[name];

  // If we are defining a new workflow
  if (_.isUndefined(result)) {
    // New workflow
    result = new Workflow(name, domain, tasklist);
    this.workflows[name] = result;
  }

  return result;
};


/**
 * Create or retrieve a workflow fragment
 * @param {string} name - The name of the fragment.
 * @returns {Workflow} - A workflow fragment instance
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


module.exports = new Usher();
