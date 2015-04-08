var chai = require('chai'),
expect = chai.expect,
fixtures = require('./fixtures'),
usher = require('../lib/usher');


describe('Workflow - Loop Execution w/ Failure', function () {

  this.timeout(71000);

  var loopWorkflow, fragment, status, events;

  before(function (done) {
    fragment = usher
      .fragment('loop-failuer-fragment-workflow')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('failure1')
        .activity('activity4', ['failure1']);

    loopWorkflow = usher
      .workflow('loop-failure', '_test_workflow_', { taskList: 'test-loop-failure-decision-tasklist' });

    loopWorkflow
      .version('1.0.0')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .loop('loop1', ['activity1'], fragment, function () {
          return ['test1', 'test2', 'test3'];
        }, {
          batchDelay: 1,
          itemsPerBatch: 1
        })
        .activity('activity2', ['loop1']);

    loopWorkflow.start();

    fixtures.execution.execute('loop-failure', '1.0.0', { input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    loopWorkflow.stop();
  });

  it('should execute a looping workflow successfuly', function () {
    expect(status).to.equal('FAILED');
  });

  it('should verify all intended activities completed successfuly', function () {
    expect(events.completed('activity1')).to.be.true;
  });

  it('should verify all intended activities failed successfuly', function () {
    expect(events.failed('loop1-0-failure1')).to.be.true;
    expect(events.failed('loop1-1-failure1')).to.be.true;
    expect(events.failed('loop1-2-failure1')).to.be.true;
  });

  it('should verify all orphaned activities did not execute', function () {
    expect(events.results('loop1-0-activity4')).to.be.null;
    expect(events.results('loop1-1-activity4')).to.be.null;
    expect(events.results('loop1-2-activity4')).to.be.null;
    expect(events.results('activity2')).to.be.null;
  });

  it('should verify all activities returned expected results', function () {
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output', input: { _input: { input: 'test input'}, _variables: {}} });
  });

});
