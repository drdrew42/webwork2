/*  SimpleEditor.js:
   This is the base javascript code for the SimplePGEditor.  This sets up the View and ....

*/


define(['module','backbone','underscore','views/MainView','views/library-views/LibraryTreeView',
    'models/Problem','models/ProblemList','views/ProblemView','config','moment','apps/util', 'bootstrap'],
function(module,Backbone, _,MainView,LibraryTreeView,Problem,ProblemList,ProblemView,
            config,moment,util){
var SimpleEditorView = Backbone.View.extend({
    initialize: function(options) {
        var self = this;
        _.bindAll(this,"changeAnswerType");
        this.problem = new Problem();
        this.model = new PGProblem();
        this.settings = options.settings;
        this.model.on({"change": this.problemChanged});

        var answerTypes = ['Number','String','Formula','Interval or Inequality',
                'Comma Separated List of Values','Multiple Choice'];
        this.answerTypeCollection = _(answerTypes).map(function(type){return {label: type, value: type};});
        this.inverseBindings = util.invertBindings(this.bindings);
        Backbone.Validation.bind(this, {
              valid: function(view, attr) {
                console.log(attr + " is valid");
              },
              invalid: function(view, attr, error) {
                console.log(error);
                var formGroup = self.$(self.inverseBindings[attr]).closest(".form-group");
                formGroup.addClass("has-error").children("label")
                    .popover({content: error,placement: "top"}).popover("show");
            }
        });

    },
    render: function (){
        this.$el.html($("#simple-editor-template").html());
        this.updateFields();
        this.libraryTreeView = new LibraryTreeView({el: this.$("#library-subjects"), parent: this,
                type: "subjects", orientation: "vertical"});
        this.libraryTreeView.render();
        this.stickit();

        return this;
    },
    events: {"click .build-script-button": "buildScript",
        "change .answer-type": "changeAnswerType",
        "click .save-file-button": "saveFile"
    },
    bindings: { ".problem-statement": {observe: "statement", events: ['blur']},
        ".problem-description": {observe: "description", events: ['blur']},
        ".problem-solution": {observe: "solution", events: ['blur']},
        ".problem-author": {observe: "problem_author", events: ['blur']},
        ".institution": {observe: "institution", events: ['blur']},
        ".text-title": {observe: "textbook_title", events: ['blur']},
        ".text-edition": {observe: "textbook_edition", events: ['blur']},
        ".text-author": {observe: "textbook_author", events: ['blur']},
        ".keywords": {observe: "keywords", events: ['blur'], onSet: function(val, options){
            return _(val.split(",")).map(function(kw) { return kw.trim()});
        }},
        ".answer-type": {observe: "answer_type", selectOptions: {collection: "this.answerTypeCollection",
            defaultOption: {label: "Select an Answer Type...", value: null}}}
    },
    problemChanged: function(model) {
  //      console.log(model);
    },
    renderProblem: function(){
      console.log("rendering the problem");
      this.showProblemView = new ShowProblemView({model: this.problem, el: $("#viewer-tab")});
      this.showProblemView.render();
      this.$("a[href='#viewer-tab']").tab("show");

    },
    updateFields: function () {
        this.model.set({problem_author: this.settings.getSettingValue("editor{author}"),
            institution: this.settings.getSettingValue("editor{authorInstitute}"),
            textbook_title: this.settings.getSettingValue("editor{textTitle}"),
            textbook_edition: this.settings.getSettingValue("editor{textEdition}"),
            textbook_author: this.settings.getSettingValue("editor{textAuthor}"),
            date: moment().format("MM/DD/YYYY")});
    },
    changeAnswerType: function(evt){
        switch($(evt.target).val()){
            case "Number":
                this.answerView = (new NumberAnswerView({el: $("#answerArea")})).render();
                break;
            case "String":
                this.answerView = (new StringAnswerView({el: $("#answerArea")})).render();
                break;
            case "Formula":
                this.answerView = (new FormulaAnswerView({el: $("#answerArea")})).render();
                break;
            case "Interval or Inequality":
                this.answerView = (new IntervalAnswerView({el: $("#answerArea")})).render();
                break;
            case "Comma Separated List of Values":
                this.answerView = (new ListAnswerView({el: $("#answerArea")})).render();
                break;
            case "Multiple Choice":
                this.answerView = (new MultipleChoiceAnswerView({el: $("#answerArea")})).render();
                break;

        }
    },
    saveFile: function(){
        var self = this;
        if(!this.buildScript()){ // build the script and check for errors.
            return;
        }

        var params = _.extend({displayMode: "MathJax", pgSource: this.model.get("pgSource")});
            this.model.renderOnServer({data: params, course_id: config.courseSettings.course_id,
                success: function(response){
                   self.problem.set({data: response.text});
                   self.renderProblem();
                }
            });

    },
    buildScript: function (){
        // check that everything should be filled in
        if(!this.model.isValid(true)){
            return false;
        }
        var pgTemplate = _.template($("#pg-template").text());
        var fields = this.libraryTreeView.fields.attributes;
        _.extend(fields,{setup_section: this.answerView.getSetupText(this.model.attributes),
            statement_section: this.answerView.getStatementText(this.model.attributes),
            answer_section: this.answerView.getAnswerText()});
console.log("in buildscript");

        _.extend(fields,this.model.attributes);
        this.model.set("pgSource",pgTemplate(fields));
        $("#problem-code").text(this.model.get("pgSource"));

        return true;
    }
});

var ShowProblemView = Backbone.View.extend({
    initialize: function(options) {
      _.bindAll(this,'render');
      this.collection = new ProblemList();  // this is done as a hack b/c Problem View assumes that all problems
                                            // are in a ProblemList.
      this.collection.add(this.model);
      problemViewAttrs = {reorderable: false, showPoints: false, showAddTool: false, showEditTool: false,
                showRefreshTool: false, showViewTool: false, showHideTool: false, deletable: false, draggable: false,
                displayMode: "MathJax"};
      this.problemView = new ProblemView({model: this.model, viewAttrs: problemViewAttrs});
    },
    render: function (){
        this.$(".problemList").html("").append(this.problemView.render().el);
    },
    setProblem: function(problem){
        this.model = problem;
    }
});

var AnswerChoiceView = Backbone.View.extend({
    render: function(){
        this.$el.html(this.viewTemplate);
        this.stickit();
        return this;
    },
    getSetupText: function (opts) {
        return this.pgSetupTemplate(opts? _.extend(opts,this.model.attributes): this.model.attributes);
    },
    getStatementText: function(opts){
        return this.pgTextTemplate(_.extend(opts,this.model.attributes));
    },
    getAnswerText: function (){
        return this.pgAnswerTemplate(this.model.attributes);
    }
});

var NumberAnswerView = AnswerChoiceView.extend({
    initialize: function () {
        this.viewTemplate = $("#number-option-template").html();
        this.pgSetupTemplate = _.template($("#number-option-pg-setup").html());
        this.pgTextTemplate = _.template($("#number-option-pg-text").html());
        this.pgAnswerTemplate = _.template($("#number-option-pg-answer").html());
        var ThisModel = Backbone.Model.extend({
            defaults: {
                answer: "", require_units: false
            },
            //validation: {answer: {required: true}}
            });
        this.model = new ThisModel();
    },
    bindings: { ".answer": "answer", ".require-units": "require_units"},
});

var StringAnswerView = AnswerChoiceView.extend({
    initialize: function () {
        this.viewTemplate = $("#string-option-template").html();
        this.pgSetupTemplate = _.template($("#string-option-pg-setup").html());
        this.pgTextTemplate = _.template($("#string-option-pg-text").html());
        this.pgAnswerTemplate = _.template($("#string-option-pg-answer").html());
        var ThisModel = Backbone.Model.extend({defaults: {answer: ""}});
        this.model = new ThisModel();
    },
    bindings: { ".answer": "answer"},
});

var FormulaAnswerView = AnswerChoiceView.extend({
    initialize: function () {
        this.viewTemplate = $("#formula-option-template").html();
        this.pgSetupTemplate = _.template($("#formula-option-pg-setup").html());
        this.pgTextTemplate = _.template($("#formula-option-pg-text").html());
        this.pgAnswerTemplate = _.template($("#formula-option-pg-answer").html());
        var ThisModel = Backbone.Model.extend({defaults: {answer: "", require_units: false, variables: ""}});
        this.model = new ThisModel();
    },
    bindings: { ".answer": "answer", ".require-units": "require_units", ".variables" : "variables"},
});


var IntervalAnswerView = AnswerChoiceView.extend({
    initialize: function () {
        this.viewTemplate = $("#interval-option-template").html();
        this.pgSetupTemplate = _.template($("#interval-option-pg-setup").html());
        this.pgTextTemplate = _.template($("#interval-option-pg-text").html());
        this.pgAnswerTemplate = _.template($("#interval-option-pg-answer").html());
        var ThisModel = Backbone.Model.extend({defaults: {answer: "", allow_interval: false, allow_inequality: false}});
        this.model = new ThisModel();
    },
    bindings: { ".answer": "answer", ".allow-interval-notation": "allow_interval",
         ".allow-inequality-notation" : "allow_inequality"},
});

var ListAnswerView = AnswerChoiceView.extend({
    initialize: function () {
        this.viewTemplate = $("#list-option-template").html();
        this.pgSetupTemplate = _.template($("#list-option-pg-setup").html());
        this.pgTextTemplate = _.template($("#list-option-pg-text").html());
        this.pgAnswerTemplate = _.template($("#list-option-pg-answer").html());
        var ThisModel = Backbone.Model.extend({defaults: {answer: ""}});
        this.model = new ThisModel();
    },
    bindings: { ".answer": "answer"},
});

var MultipleChoiceAnswerView = AnswerChoiceView.extend({
    initialize: function () {
        this.viewTemplate = $("#multiple-choice-option-template").html();
        this.pgSetupTemplate = _.template($("#multiple-choice-option-pg-setup").html());
        this.pgTextTemplate = _.template($("#multiple-choice-option-pg-text").html());
        this.pgAnswerTemplate = _.template($("#multiple-choice-option-pg-answer").html());
        var ThisModel = Backbone.Model.extend({defaults: {answer: "", extra_choice: "", last_choice: "", use_last_choice: false}});
        this.model = new ThisModel();
    },
    bindings: { ".answer": "answer", ".extra-choice": "extra_choice", ".last-choice": "last_choice",
        ".use-last-choice": "use_last_choice"},
});


return SimpleEditorView;
});
