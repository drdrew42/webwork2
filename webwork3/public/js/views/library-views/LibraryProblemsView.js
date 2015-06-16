/**
 * This is the view of displaying any problems in the library.  It is a ProblemListView with some additional 
 * functionality including highlighting problems from the library that are in the target set.  
 *
 **/


define(['backbone', 'views/ProblemListView','config'], 
function(Backbone, ProblemListView,config) {
    var LibraryProblemsView = ProblemListView.extend({
        initialize: function (options) {
            _(this).bindAll("highlightCommonProblems");
            this.viewAttrs = {reorderable: false, showPoints: false, showAddTool: true, 
                              showEditTool: false, problem_seed: 1, showRefreshTool: true, 
                              showViewTool: false, showHideTool: true, deletable: false, draggable: true};
            _.extend(this,_(options).pick("problemSets","libraryView","settings","type"));
            ProblemListView.prototype.initialize.apply(this,[options]); 
        },
        render: function(){
            //this.libraryView.libraryProblemsView.set({current_page: this.libraryView.tabState.get("page_num"),
            this.set({current_page: this.libraryView.tabState.get("page_num"),
                        display_mode: this.libraryView.parent.state.get("display_mode")});
            ProblemListView.prototype.render.apply(this);
            this.libraryView.libraryProblemsView.on("page-changed",this.highlightCommonProblems);
            this.highlightCommonProblems();
            this.libraryView.libraryProblemsView.viewAttrs.displayMode =
                    this.libraryView.parent.state.get("display_mode");
            this.$(".prob-list-container").height($(window).height()-((this.maxPages==1) ? 200: 250));
            return this;
        },
        showMLT: function(_model,_show){
            var self = this; 
            var pvs = _(this.problemViews).filter(function(pv){   
                        return pv.model.get("morelt_id")==_model.get("morelt_id");})
            _(pvs).each(function(pv,i) { 
                if(i>0) {
                    pv.state.set("hidden", !_show);
                    //config.changeClass({state: _show, els: pv.$el, remove_class: "hidden"}); 
                }
                if(i>0 && i<pvs.length-1){
                    config.changeClass({state: _show, els: pv.$el, 
                                    add_class: "mlt-middle", remove_class: "problem"}); 
                }
            }); 
            config.changeClass({state: _show, els: pvs[0].$el,
                                add_class: "mlt-top", remove_class: "problem"});
            config.changeClass({state:  _show, els: pvs[pvs.length-1].$el,
                                add_class: "mlt-bottom", remove_class: "problem"});

            
        },
        highlightCommonProblems: function () {
            var self = this;
            if(this.libraryView.targetSet){ 
                var pathsInTargetSet = this.libraryView.problemSets.findWhere({set_id: this.libraryView.targetSet})
                    .problems.pluck("source_file");
                var pathsInLibrary = this.problems.pluck("source_file");
                var pathsInCommon = _.intersection(pathsInLibrary,pathsInTargetSet);
                if(this.problemViews){
                    _(this.pageRange).each(function(i){
                        var pv = self.problemViews[i];
                        if(pv.rendered){
                            pv.highlight(_(pathsInCommon).contains(pathsInLibrary[i]));
                        } else {
                            pv.model.once("rendered", function(v) {
                                v.highlight(_(pathsInCommon).contains(pathsInLibrary[i]));
                            });
                        }
                    });
                }
            }
            return this;
        }
    });

    return LibraryProblemsView;
});