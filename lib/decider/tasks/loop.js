/*!
 * Usher
 * Copyright(c) 2014 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    _ = require('lodash'),
    WorkflowExecution = require('../execution'),
    Context = require('../context'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = Loop;


function Loop(name, deps, fragment, loopFn) {
  if (!(this instanceof Loop)) {
    return new Loop(name, deps, fragment, loopFn);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.fragment = fragment;
  this.loopFn = loopFn || function (input) { return [input]; };
  this.executionContexts = [];
}

util.inherits(Loop, Task);


Loop.prototype.execute = function execute(ctx) {

  // Get loop input data
  var input = this.loopFn.call(this, ctx.input(this));

  _.each(input, function (data, i) {
    var execution = new WorkflowExecution(this.fragment.tasks()),
        context = new Context(ctx.decisionTask, this.name + '-' + i);

    context.setWorkflowInput(data);
    execution.execute(context);

    this.executionContexts[i] = context;
  }.bind(this));

  var complete = _.every(this.executionContexts, function (c) {
    return c.done();
  });

  if (complete) {
    ctx.addResult(this, _.map(this.executionContexts, function (c) { return c.results; }));
    return STATUS.mask('complete', 'resolved');
  } else {
    return STATUS.mask('outstanding');
  }

};
