var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');

describe('Workflow - Nested While Loop Execution', function () {

  this.timeout(71000);

  var whileLoopWorkflow, loopFragment, whileFragment, status, events;

  before(function (done) {

    loopFragment = usher
      .fragment('while-loop-fragment-workflow')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity3');

    whileFragment = usher
      .fragment('while-fragment-workflow')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('while-activity2')
        .loop('loop1', ['while-activity2'], loopFragment, function (input) {
          return input['while-activity2'];
        });

    whileLoopWorkflow = usher
      .workflow('nested-while', '_test_workflow_', { taskList: 'test-nested-while-decision-tasklist' });

    whileLoopWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .whileLoop('while1', ['activity1'], whileFragment, function (results) {
          return results['while-activity2'].length <= 0;
        })
        .activity('activity2', ['while1']);

    whileLoopWorkflow.start();

    fixtures.execution.execute('nested-while', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    whileLoopWorkflow.stop();
  });

  it('should execute a while loop workflow successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed(
      'activity1',
      'activity2');
    expect(completed).to.be.true;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output', input: { _input: { input: 'test input'}} });

    var items = ['item1', 'item2', 'item3'],
        activity3Result = { activity3: 'Activity 3 output' };

    expect(events.results('while1-0-while-activity2')).to.deep.equal(items);
    expect(events.results('while1-1-while-activity2')).to.deep.equal(items);
    expect(events.results('while1-2-while-activity2')).to.deep.equal([]);

    expect(events.results('while1-0-loop1-0-activity3')).to.deep.equal(activity3Result);
    expect(events.results('while1-0-loop1-1-activity3')).to.deep.equal(activity3Result);
    expect(events.results('while1-0-loop1-2-activity3')).to.deep.equal(activity3Result);

    expect(events.results('while1-1-loop1-0-activity3')).to.deep.equal(activity3Result);
    expect(events.results('while1-1-loop1-1-activity3')).to.deep.equal(activity3Result);
    expect(events.results('while1-1-loop1-2-activity3')).to.deep.equal(activity3Result);

    expect(events.results('activity2')).to.deep.equal({ activity2: 'Activity 2 output' });
  });

});
