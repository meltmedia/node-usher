/*!
 * Usher
 * Copyright(c) 2016 meltmedia <mike@meltmedia.com>
 */

'use strict';

var util = require('util'),
    winston = require('winston'),
    _ = require('lodash'),
    async = require('async'),
    WorkflowExecution = require('../execution'),
    Context = require('../context'),
    Task = require('./task'),
    STATUS = require('./status');


module.exports = Accumulator;

/**
 * The Accumulator loop executes the `fragment` until the `resultsFn` returns an empty array,
 * the results of each execution are then pushed into an array via the `resultsFn` for use by other tasks.
 *
 * @constructor
 */
function Accumulator(name, deps, fragment, resultsFn, options) {
  if (!(this instanceof Accumulator)) {
    return new Accumulator(name, deps, fragment, resultsFn, options);
  }

  Task.apply(this, Array.prototype.slice.call(arguments));

  this.fragment = fragment;

  if (!_.isFunction(resultsFn)) {
    throw new Error('You must provide a function to indicate when the accumulator is complete');
  }

  this.resultsFn = resultsFn;
  this.options = options || {};
}

util.inherits(Accumulator, Task);


Accumulator.prototype.execute = function execute(ctx, done) {

  var resolvedName = ctx.namespace ? ctx.namespace + '-' + this.name : this.name,
      input = ctx.input(this),
      state = ctx.lastState(this),
      self = this,
      executionContexts;

  // Make sure we have a state
  state = state ? state : { currentIndex: 0 };


  function evaluateState() {

    executionContexts = [];

    for (var i = 0; i <= state.currentIndex; i++) {
      // Build the execution context for the current iteration
      // Depending on the index, this could be the first of our iterations, or
      // picking back up a previously run iteration
      var currentExecution = {
        execution: new WorkflowExecution(self.fragment.sequencedTasks()),
        context: new Context(ctx.decisionTask, self.name + '-' + i, ctx.localVariables)
      };

      executionContexts.push(currentExecution);
    }

    // Execute every iteration we've scheduled so far to see what state they are in
    // Does this need to be .mapSeries?
    async.reduce(executionContexts, [], function (memo, item, next) {

      // Store the previous result for use by later iterations
      input._variables.previousResult = _.get(_.last(memo), 'results', null);
      item.context.setWorkflowInput(input);

      item.execution.execute(item.context, function (err) {
        if (err) {
          return next(err);
        }

        if (item.context.failed()) {
          return next(new Error());
        }

        // If current execution has finished running, check to see if it resolves our 'done' state
        if (item.context.done()) {

          // Get the results of this iteration
          var results = self.resultsFn.call(self, item.context.results);

          // We are done, we can mark our task resolved
          if (!_.isArray(results) || results.length < 1) {
            memo.push({
              outstanding: false,
              done: true,
              results: results
            });
            return next(null, memo); // The results of this execution did resolve the accumulators 'done' state
          } else {
            memo.push({
              outstanding: false,
              done: false,
              results: results
            });

            return next(null, memo); // The results of this execution did NOT resolve the accumulators 'done' state
          }
        }

        // This execution is still outstanding
        memo.push({
          outstanding: true,
          done: false,
          results: []
        });
        return next(null, memo);
      });

    // Once the states of our current iterations are complete, we evaluate the state of our task.
    // From here we can still be outstanding (waiting for task to finish), resolved (all work is done), or
    // schedule new tasks.
    }, function (err, results) {
        if (err) {
          winston.log('error', 'An problem occured in the accumulator: %s, failing due to: ', resolvedName, err.stack);
          return done(STATUS.mask('failed'));
        }

        var isOutstanding = _.some(results, 'outstanding'),
            isDone = _.some(results, 'done');

        if (isOutstanding && isDone) {
          // This should never be true, if so, we need to let someone know
          winston.log('error', 'Invalid state in accumulator: %s, both \'done\' and \'outstanding\' state are currently true.', resolvedName);
        }

        // Still more work to be done on existing iterations
        if (isOutstanding) {
          return done(STATUS.mask('outstanding'));
        }

        // All iterations are complete and our 'done' criteria has been meet
        if (isDone) {
          // Make sure the results are available as a single array
          ctx.addResult(self, _.reduce(results, function (result, item) {
            return result.concat(item.results);
          }, []));

          return done(STATUS.mask('complete', 'resolved'));
        }

        // Not done yet, schedule another iteration
        state.currentIndex++;

        // Save our state
        ctx.saveState(self, state);

        // Our input can change based on our current state
        input = ctx.input(self);

        // Evaluate the newly scheduled iteration
        evaluateState();
    });
  }

  // Run through the current state of the accumulator and set our state and schedule any work that needs to be done
  evaluateState();

};
