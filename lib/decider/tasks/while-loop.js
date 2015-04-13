/*!
 * Usher
 * Copyright(c) 2015 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    winston = require('winston'),
    _ = require('lodash'),
    WorkflowExecution = require('../execution'),
    Context = require('../context'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = WhileLoop;

/**
 * The loop executes the `fragment` until the `doneFn` returns a truthy value
 *
 * @constructor
 */
function WhileLoop(name, deps, fragment, doneFn, options) {
  if (!(this instanceof WhileLoop)) {
    return new WhileLoop(name, deps, fragment, doneFn, options);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.fragment = fragment;

  if (!_.isFunction(doneFn)) {
    throw new Error('You must provide a function to indicate when the loop is complete');
  }

  this.doneFn = doneFn;
  this.options = options || {};
}

util.inherits(WhileLoop, Task);


WhileLoop.prototype.execute = function execute(ctx, done) {

  var resolvedName = ctx.namespace ? ctx.namespace + '-' + this.name : this.name,
      input = ctx.input(this),
      state = ctx.lastState(this),
      self = this;

  // Make sure we have a state
  state = state ? state : { currentIndex: 0 };

  // Build the execution context for the current iteration
  // Depending on the index, this could be the first of our iterations, or
  // picking back up a previously run iteration
  var currentExecution = new WorkflowExecution(this.fragment.tasks()),
      currentContext = new Context(ctx.decisionTask, this.name + '-' + state.currentIndex, ctx.localVariables);

  // Execute the current context.
  // If this is has already been done before, this will drive our state forward.
  currentContext.setWorkflowInput(input);
  currentExecution.execute(currentContext, function (err) {
    if (err) {
      winston.log('error', 'An problem occured in while-loop: %s, failing due to: ', resolvedName, err.stack);
      return done(STATUS.mask('failed'));
    }
    handleSuccess();
  });


  function handleSuccess() {

    // If our iteration failed, we mark ourselves as failed
    if (currentContext.failed()) {
      return done(STATUS.mask('failed'));
    }

    // Else if current execution has finished running, check to see if it resolves our 'done' state
    if (currentContext.done()) {

      // We are done, we can mark our task resolved
      if (self.doneFn.call(self, currentContext.results)) {
        return done(STATUS.mask('complete', 'resolved'));
      }

      // The last execution did not meet our 'done' criteria so we need to start
      // a new execution iteration
      state.currentIndex++;

      // Save our state
      ctx.saveState(self, state);

      // Our input can change based on our current state
      input = ctx.input(self);

      var nextExecution = new WorkflowExecution(self.fragment.tasks()),
          nextContext = new Context(ctx.decisionTask, resolvedName + '-' + state.currentIndex, ctx.localVariables);

      // Execute the current context.
      // If this is has already been done before, this will drive our state forward.
      nextContext.setWorkflowInput(input);

      // Since we are scheduling the next iteration we ignore the context status
      // When the decider comes back to this loop in it's next decision this context will be evaluated
      nextExecution.execute(nextContext, function () {
        done(STATUS.mask('outstanding'));
      });

    } else {
      done(STATUS.mask('outstanding'));
    }

  }

};
