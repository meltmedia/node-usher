var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');

describe('Workflow - Accumulator Execution', function () {

  this.timeout(71000);

  var accumulatorWorkflow, fragment, status, events;

  before(function (done) {
    fragment = usher
      .fragment('accumulator-fragment-workflow')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('accumulator-activity1');

    accumulatorWorkflow = usher
      .workflow('accumulator', '_test_workflow_', { taskList: 'test-accumulator-decision-tasklist' });

    accumulatorWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .accumulator('accumulator1', ['activity1'], fragment, function (results) {
          return results['accumulator-activity1'];
        })
        .activity('accumulator-results', ['accumulator1']);

    accumulatorWorkflow.start();

    fixtures.execution.execute('accumulator', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    accumulatorWorkflow.stop();
  });

  it('should execute a accumulator workflow successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed(
      'activity1',
      'accumulator-results');
    expect(completed).to.be.true;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output', input: { _input: { input: 'test input'}, _variables: {}} });
    expect(events.results('accumulator1-0-accumulator-activity1')).to.deep.equal(['item1-1', 'item2-1', 'item3-1']);
    expect(events.results('accumulator1-1-accumulator-activity1')).to.deep.equal(['item1-2', 'item2-2', 'item3-2']);
    expect(events.results('accumulator1-2-accumulator-activity1')).to.deep.equal(['item1-3', 'item2-3', 'item3-3']);
    expect(events.results('accumulator1-3-accumulator-activity1')).to.deep.equal(['item1-4', 'item2-4', 'item3-4']);
    expect(events.results('accumulator1-4-accumulator-activity1')).to.deep.equal(['item1-5', 'item2-5', 'item3-5']);
    expect(events.results('accumulator1-5-accumulator-activity1')).to.deep.equal(['item1-6', 'item2-6', 'item3-6']);
    expect(events.results('accumulator1-6-accumulator-activity1')).to.deep.equal([]);
    expect(events.results('accumulator-results').accumulator1).to.deep.equal([
      'item1-1', 'item2-1', 'item3-1',
      'item1-2', 'item2-2', 'item3-2',
      'item1-3', 'item2-3', 'item3-3',
      'item1-4', 'item2-4', 'item3-4',
      'item1-5', 'item2-5', 'item3-5',
      'item1-6', 'item2-6', 'item3-6'
    ]);
  });

});
