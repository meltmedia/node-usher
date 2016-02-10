var chai = require('chai'),
    expect = chai.expect,
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Loop Execution w/ Batch', function () {

  this.timeout(71000);

  var loopWorkflow, fragment, status, events;

  before(function (done) {
    fragment = usher
      .fragment('loop-batch-fragment-workflow')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity3')
        .activity('activity4', ['activity3']);

    loopWorkflow = usher
      .workflow('loop-batch', '_test_workflow_', { taskList: 'test-loop-batch-decision-tasklist' });

    loopWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .loop('loop1', ['activity1'], fragment, function () {
          return ['test1', 'test2', 'test3', 'test4', 'test5'];
        }, {
          batchDelay: 1,
          itemsPerBatch: 3,
          maxOutstanding: 2
        })
        .activity('activity2', ['loop1']);

    loopWorkflow.start();

    fixtures.execution.execute('loop-batch', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    loopWorkflow.stop();
  });

  it('should execute a looping workflow successfuly', function () {
    expect(status).to.equal('COMPLETED');
  });

  it('should verify all activities completed successfuly', function () {
    var completed = events.completed(
      'activity1',
      'activity2');
    expect(completed).to.be.true;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output', input: { _input: { input: 'test input'}, _variables: {}} });
    expect(events.results('loop1-0-activity3')).to.deep.equal({ activity3: 'Activity 3 output' });
    expect(events.results('loop1-0-activity4')).to.deep.equal({ activity4: 'Activity 4 output' });
    expect(events.results('loop1-1-activity3')).to.deep.equal({ activity3: 'Activity 3 output' });
    expect(events.results('loop1-1-activity4')).to.deep.equal({ activity4: 'Activity 4 output' });
    expect(events.results('loop1-2-activity3')).to.deep.equal({ activity3: 'Activity 3 output' });
    expect(events.results('loop1-2-activity4')).to.deep.equal({ activity4: 'Activity 4 output' });
    expect(events.results('loop1-3-activity3')).to.deep.equal({ activity3: 'Activity 3 output' });
    expect(events.results('loop1-3-activity4')).to.deep.equal({ activity4: 'Activity 4 output' });
    expect(events.results('loop1-4-activity3')).to.deep.equal({ activity3: 'Activity 3 output' });
    expect(events.results('loop1-4-activity4')).to.deep.equal({ activity4: 'Activity 4 output' });
    expect(events.results('activity2')).to.deep.equal({ activity2: 'Activity 2 output' });
  });

});
