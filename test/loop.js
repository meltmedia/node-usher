var chai = require('chai'),
    expect = chai.expect,
    swf = require('aws-swf'),
    fixtures = require('./fixtures'),
    usher = require('../lib/usher');


describe('Workflow - Loop Execution', function () {

  this.timeout(31000);

  var parentWorkflow, fragment, status, events;

  before(function (done) {
    fragment = usher
      .fragment('fragment-workflow')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity3')
        .activity('activity4', ['activity3']);

    parentWorkflow = usher
      .workflow('loop-workflow', '_test_workflow_', 'test-workflow-decision-tasklist')
        .activityDefaults({
          taskList: 'test-workflow-activity-tasklist'
        })
        .activity('activity1')
        .loop('loop1', ['activity1'], fragment, function () {
          return ['test1', 'test2'];
        })
        .activity('activity2', ['loop1']);

    parentWorkflow.start();

    fixtures.execution.execute({ input: 'test input' }, function (err, s, e) {
      status = s;
      events = e;
      done(err);
    });
  });

  after(function () {
    parentWorkflow.stop();
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
    expect(events.results('activity1')).to.deep.equal({ activity1: 'Activity 1 output' });
    expect(events.results('loop1-0-activity3')).to.deep.equal({ activity3: 'Activity 3 output' });
    expect(events.results('loop1-0-activity4')).to.deep.equal({ activity4: 'Activity 4 output' });
    expect(events.results('loop1-1-activity3')).to.deep.equal({ activity3: 'Activity 3 output' });
    expect(events.results('loop1-1-activity4')).to.deep.equal({ activity4: 'Activity 4 output' });
    expect(events.results('activity2')).to.deep.equal({ activity2: 'Activity 2 output' });
  });

});
