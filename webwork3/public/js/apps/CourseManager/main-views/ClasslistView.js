/*  ClasslistManager.js:
This is the base javascript code for the UserList3.pm (Classlist Manager).  This sets up the View and the classlist object.

*/

define(['backbone','jquery','underscore','views/MainView','models/UserList','models/User','config','views/CollectionTableView',
'models/ProblemSetList','views/ModalView',
'views/ChangePasswordView','views/EmailStudentsView','config','apps/util','moment','jquery-ui/widgets/dialog','bootstrap','jquery-csv'],
function(Backbone,$,_,MainView,UserList,User,config,CollectionTableView,
  ProblemSetList,ModalView,ChangePasswordView,EmailStudentsView,config,util,moment,dialog){
    var ClasslistView = MainView.extend({
      msgTemplate: _.template($("#classlist-messages").html()),
      initialize: function (options) {
        MainView.prototype.initialize.call(this,options);
        _.bindAll(this, 'render','deleteUsers','changePassword','syncUserMessage','removeUser');  // include all functions that need the this object
        var self = this;

        this.addStudentManView = new AddStudentManView({users: this.users,
              messageTemplate: this.msgTemplate, problemSets: this.problemSets});
        this.addStudentFileView = new AddStudentFileView({users: this.users,messageTemplate: this.msgTemplate});
        this.addStudentManView.on("modal-opened",function (){
          self.state.set("man_user_modal_open",true);
        }).on("modal-closed",function(){
          self.state.set("man_user_modal_open",false);
          self.render(); // for some reason the checkboxes don't stay checked.
        })
        this.addStudentFileView.on("modal-closed",this.render);


        this.tableSetup();

        this.users.on({"add": this.addUser,"change": this.changeUser,"sync": this.syncUserMessage,
          "remove": this.removeUser});
        this.userTable = new CollectionTableView({columnInfo: this.cols, collection: this.users, row_id_field: "user_id",
          paginator: {page_size: 10, button_class: "btn btn-default", row_class: "btn-group"}});

        this.userTable.on({
          "page-changed": function(num){
            self.state.set("current_page",num);
            self.update();
          },
          "table-sorted": function(info){
            self.state.set({sort_class: info.classname, sort_direction: info.direction});
          },
          "selected-row-changed": function(rowIDs){
            self.state.set({selected_rows: rowIDs});
          },
          "table-changed": function(){  // I18N
            self.$(".num-users").html(self.userTable.getRowCount() + " of " + self.users.length + " users shown.");
          }
        });

        this.state.on("change:filter_string", function () {
          self.state.set("current_page",0);
          self.userTable.set(self.state.pick("filter_string","current_page"));
          self.userTable.updateTable();
          self.colorFilterBox();
        });

        $("div#addStudFromFile").dialog({autoOpen: false, modal: true, title: "Add Student from a File",
        width: (0.95*window.innerWidth), height: (0.95*window.innerHeight) });


        // bind the collection to the Validation.  See Backbone.Validation at https://github.com/thedersen/backbone.validation
        this.users.each(function(model){
          model.bind('validated:invalid', function(_model, errors) {

            // if the classlist view isn't the main view, ignore the error.
            // pstaab:  perhaps there is a better way of handling the errors on a global basis.

            if(self.parent.currentView.info.id!=="classlist"){
              return;
            }

            var row;
            self.$("td.user-id").each(function(i,v){
              if($(v).text()===_model.get("user_id")){
                row = i;
              }
            })

            _(_.keys(errors)).each(function(key){
              var obj = _(self.userTable.columnInfo).findWhere({key: key});
              var col = _(self.userTable.columnInfo).indexOf(obj);
              self.eventDispatcher.trigger("add-message",{text: errors[key],type: "danger", short: "Validation Error"});
              self.$("tbody tr:nth-child("+ (row+1) +") td:nth-child("+(col+1)+")")
              .css("background-color","rgba(255,0,0,0.25)");
            });
          });
        });

        this.passwordPane = new ChangePasswordView({msgTemplate: this.msgTemplate});
        this.emailPane = new EmailStudentsView({users: this.users});

        // query the server every 15 seconds (parameter?) for login status only when the View is visible
        this.eventDispatcher.on("change-view",function(viewID){
          if(viewID==="classlist"){
            self.checkLoginStatus();
          } else {
            self.stopLoginStatus();
          }
        })
      },
      colorFilterBox: function(){
        if(this.state.get("filter_string").length==0){
          this.$(".filter-text").removeAttr("style");
        } else {
          this.$(".filter-text").css("background-color","lightyellow");
        }
      },
      render: function(){
        this.$el.html($("#classlist-manager-template").html());
        this.userTable.render().$el.addClass("table table-bordered table-condensed");
        this.$(".users-table-container").append(this.userTable.el);
        // set up some styling
        this.userTable.$(".paginator-row td").css("text-align","center");
        this.userTable.$(".paginator-page").addClass("btn");

        var opts = this.state.pick("page_size","filter_string","current_page","selected_rows");
        if(this.state.get("sort_class")&&this.state.get("sort_direction")){
          _.extend(opts,{sort_info: this.state.pick("sort_direction","sort_class")});
        }
        this.showRows(this.state.get("page_size"));
        this.userTable.set(opts).updateTable();
        this.stickit(this.state,this.bindings);


        MainView.prototype.render.apply(this);
        if(this.state.get("man_user_modal_open")){
          this.addStudentManView.setElement(this.$(".modal-container")).render();
        }
        this.update();
        this.colorFilterBox();
        return this;
      },
      bindings: { ".filter-text": "filter_string"},
      getDefaultState: function () {
        return {filter_string: "", current_page: 0, page_size: this.settings.getSettingValue("ww3{pageSize}") || 10,
        sort_class: "", sort_direction: "", selected_rows: []};
      },
      addUser: function (_user){
        _user._user_added = true;
        _user.save();
      },
      changeUser: function(_user){

        if((_user.changingAttributes && _(_user.changingAttributes).has("user_added"))
        || _.keys(_user.changed)[0]==="action"){
          return;
        }
        _user.changingAttributes=_.pick(_user._previousAttributes,_.keys(_user.changed));
        if(_.intersection(_.keys(_user.changed),_.keys(_user.defaults)).length >0 ){ // only save default attributes
          _user.save();
        }
      },
      removeUser: function(_user){
        var self = this;
        _user._user_removed = true;
        // remove the user from all problem sets and save the set.
        self.problemSets.chain().filter(function(_set){
            return _set.get("assigned_users").findWhere({user_id: _user.get("user_id")}) })
                  .each(function(_set){
                    _set.get("assigned_users").remove(_user.get("user_id")).save();
                  });
        _user.destroy();
        // _user.destroy({success: function(model){
        //
        //   self.render();
        // }});
      },
      syncUserMessage: function(_user){
        var self = this;
        if(_user._user_removed){
          this.eventDispatcher.trigger("add-message",{type: "success",
          short: this.msgTemplate({type: "user_removed", opts:{username:_user.get("user_id")}}),
          text: this.msgTemplate({type: "user_removed_details", opts: {username: _user.get("user_id")}})});
          //self.render();
          delete _user._user_removed;
        }
        if(_user._user_added){
          this.eventDispatcher.trigger("add-message",{type: "success",
            short: this.msgTemplate({type: "user_added", opts:{username:_user.get("user_id")}}),
            text: this.msgTemplate({type: "user_added_details", opts: {username: _user.get("user_id")}})});
          this.userTable.refreshTable();
          delete _user._user_added;
        }
        _(_user.changingAttributes).chain().keys().each(function(key){
              self.eventDispatcher.trigger("add-message",{type: "success",
                short: self.msgTemplate({type:"user_saved",opts:{username:_user.get("user_id")}}),
                text: self.msgTemplate({type:"user_saved_details",opts:{username:_user.get("user_id"),
                key: key, oldValue: _user.changingAttributes[key], newValue: _user.get(key)}})});
          });
      },
      events: {
        "click .add-students-file-option": "addStudentsByFile",
        "click .add-students-man-option": "addStudentsManually",
        "click .export-students-option": "exportStudents",
        'click button.clear-filter-button': 'clearFilterText',
        "click a.email-selected": "emailSelected",
        "click a.password-selected": "changedPasswordSelected",
        "click a.delete-selected": "deleteUsers",
        "click a.show-rows": function(evt){
          this.showRows(evt);
          this.userTable.updateTable();
        }
      },
      addStudentsByFile: function () {
        this.addStudentFileView.setElement(this.$(".modal-container")).render();
      },
      addStudentsManually: function () {
        this.addStudentManView.setElement(this.$(".modal-container")).render();
      },
      exportStudents: function () {
        var textFileContent = _(config.userProps).map(function (prop) { return "\"" + prop.longName + "\"";}).join(",") + "\n";

        // Write out the user Props
        this.users.each(function(user){
          textFileContent += user.toCSVString();
        });

        var _mimetype = "text/csv";
        var blob = new Blob([textFileContent], {type:_mimetype});
        var _url = URL.createObjectURL(blob);
        var _filename = config.courseSettings.course_id + "-classlist-" + moment().format("MM-DD-YYYY") + ".csv";
        var tmpl = _.template($("#export-to-file-template").html());
        var body = tmpl({url: _url, filename: _filename});
        var modalView = new ModalView({
          modal_size: "modal-lg",
          modal_buttons: $("#close-button-template").html(),
          modal_header: "Export Users",
          modal_body: body});
          this.$el.append(modalView.render().el);
          //modalView.render().open();
        },
        clearFilterText: function () {
          this.state.set("filter_string","");
        },
        update: function (){
          $("tr[data-row-id='profa'] select.permission").attr("disabled","disabled");
        },
        showRows: function(arg){
          this.state.set("page_size", _.isNumber(arg) || _.isString(arg) ? parseInt(arg) : $(arg.target).data("num"));
          this.$(".show-rows i").addClass("not-visible");
          this.$(".show-rows[data-num='"+this.state.get("page_size")+"'] i").removeClass("not-visible");
          this.userTable.set({page_size: this.state.get("page_size")});
        },
        tableSetup: function () {
          var self = this;
          this.cols = [
            {name: "Select", key: "_select_row", classname: "select-user"},
            {name: "Login Name", key: "user_id", classname: "login-name", datatype: "string",editable: false},
            {name: "LS", key: "logged_in",classname:"logged-in-status", datatype: "none", editable: false,
                title: "Logged in status", searchable: false,
                stickit_options: {update: function($el, val, model, options) {
                  $el.html(val?"<i class='fa fa-circle' style='color: green'></i>":"")
                }}
            },
            {name: "Assigned Sets", key: "assigned_sets", classname: "assigned-sets", datatype: "integer",
                searchable: false,
                value: function(model){
                  return self.problemSets.filter(function(_set){
                      return _set.get("assigned_users").findWhere({user_id: model.get("user_id")}) }).length
                  },
                display: function(val){
                  return val + "/" + self.problemSets.length;
            }
          },
          {name: "First Name", key: "first_name", classname: "first-name", editable: true, datatype: "string",
              stickit_options: {events: ['blur']},sort_ignore_case: true,},
          {name: "Last Name", key: "last_name", classname: "last-name", editable: true, datatype: "string",
              stickit_options: {events: ['blur']},sort_ignore_case: true,},
          {name: "Email", key: "email_address", classname: "email", sortable: false,
              stickit_options: {
                update: function($el,val,model,options){
                    // Perhaps this can go into config.js as a Stickit Handler.
                    // in addition, a lot of this needs to go into templates for I18N
                    var address = (val=="")?$("<span>"):$("<a>").attr("href","mailto:"+val);
                    address.text("email");  // I18N

                    var popoverHTML = "<input class='edit-email' value='"+ val +"'></input>"
                    + "<button class='close-popover btn btn-default btn-sm'>Save and Close</button>";
                    var edit = $("<a>").attr("href","#").text("edit")
                    .attr("data-toggle","popover")
                    .attr("data-title","Edit Email Address")
                    .popover({html: true, content: popoverHTML})
                    .on("shown.bs.popover",function (){
                      $el.find(".edit-email").focus();
                    });
                    function saveEmail(){
                      model.set("email_address",$el.find(".edit-email").val());
                      edit.popover("hide");
                    }
                    $el.html(address).append("&nbsp;&nbsp;").append(edit);
                    $el.delegate(".close-popover","click",saveEmail);
                    $el.delegate(".edit-email","keyup",function(evt){
                      if(evt.keyCode==13){
                        saveEmail();
                      }
                    })
                  }
          }},
          {name: "Student ID", key: "student_id", classname: "student-id",  editable: true, datatype: "string",
            stickit_options: {events: ['blur']}},
          {name: "Status", key: "status", classname: "status", datatype: "string",
            search_value: function(model){
              return _(config.enrollment_statuses).findWhere({value: model.get("status")}).label;
            },
            stickit_options: { selectOptions: { collection: config.enrollment_statuses }}},
          {name: "Section", key: "section", classname: "section",  editable: true, datatype: "string",
            stickit_options: {events: ['blur']}},
          {name: "Recitation", key: "recitation", classname: "recitation",  editable: true, datatype: "string",
            stickit_options: {events: ['blur']}},
          {name: "Comment", key: "comment", classname: "comment",  editable: true, datatype: "string",
            stickit_options: {events: ['blur']}},
          {name: "Permission", key: "permission", classname: "permission", datatype: "string",
            search_value: function(model){
              return  _(config.permissions).findWhere({value: ""+model.get("permission")}) || "";   // the ""+ is needed to stringify the permission level
            },
            stickit_options: { selectOptions: { collection: config.permissions }}
          }];
    },
    deleteUsers: function(){
      var userIDs = this.userTable.getVisibleSelectedRows();
      if(userIDs.length === 0){
        alert("You haven't selected any users to delete.");
        return;
      }
      var usersToDelete = this.users.filter(function(u){ return _(userIDs).contains(u.get("user_id"));});
      var self = this
      , str = "Do you wish to delete the following students: " +
      _(usersToDelete).map(function (user) {
        return user.get("first_name") + " "+ user.get("last_name")}).join(", ")
        , del = confirm(str);
        if (del){
          this.users.remove(usersToDelete);
          this.userTable.updateTable();
          this.state.set("selected_rows",[]);
        }
      },
      checkLoginStatus: function () {
        var self = this;
        this.loginStatusTimer = window.setInterval(function(){
          $.ajax({url: config.urlPrefix + "courses/" + config.courseSettings.course_id + "/users/status/login",
          type: "GET",
          success: function(data){
            _(data).each(function(st){
              var user = self.users.findWhere({user_id: st.user_id});
              if(user){
                user.set("logged_in",st.logged_in);
              }
            })
          }});

        }, 15000);
      },
      stopLoginStatus: function(){
        window.clearTimeout(this.loginStatusTimer);
      },
      changedPasswordSelected: function(){
        var user_ids = $.makeArray($("._select_row:checked").map(function(i,v) { return $(v).closest("tr").data("rowId");}))
        this.passwordPane.users=new UserList(this.users.filter(function(_user){return _(user_ids).contains(_user.get("user_id"));}));
        this.passwordPane.setElement(this.$(".modal-container")).render();
      },
      changePassword: function(rows){
        this.passwordPane.$el.dialog("open");
      },
      emailSelected: function(){
        alert("Emailing students is not implemented yet");
      },
      emailStudents: function(rows){
        this.emailPane.users = this.state.get("selected_rows")
        this.emailPane.render();
        this.emailPane.$el.dialog("open");
      },
      getHelpTemplate: function (){
        return $("#classlist-help-template").html();
      }
    });

    var AddStudentManView = ModalView.extend({
      initialize: function(options){
        var self=this;
        _.bindAll(this, 'render','saveAndClose','saveAndAddStudent'); // every function that uses 'this' as the current object should be in here
        _(this).extend(_(options).pick("users","messageTemplate","problemSets"));
        this.collection = new UserList();
        this.model = new User();
        this.invBindings = _.extend(_.invert(_.omit(this.bindings,".permission")),
        {"user_id": ".user-id", "email_address": ".email"});
        _(options).extend({
          modal_size: "modal-lg",
          modal_header: "Add Users to Course", // I18N
          modal_body: $("#manual-import-template").html(),
          modal_buttons: $("#manual-import-buttons").html()
        })
        this.setValidation();
        ModalView.prototype.initialize.apply(this,[options]);
      },
      childEvents: {
        "click .action-button": "saveAndAssign",
        "click .add-more-button": "saveAndAddStudent",
        "click .save-button": "saveAndClose"
      },
      setValidation: function (){
        var self = this;
        Backbone.Validation.bind(this, {
          invalid: function(view,attr,error){
            self.$(self.invBindings[attr]).popover("destroy")
            .popover({placement: "right", content: error})
            .popover("show").addClass("error");
          },
          valid: function(view,attr){
            self.$(self.invBindings[attr]).popover("destroy").removeClass("error");
          }
        });
      },
      render: function(){
        ModalView.prototype.render.apply(this);
        this.stickit();
      },
      bindings : {
        ".student-id": "student_id",
        ".last-name": "last_name",
        ".first-name": "first_name",
        ".status": "status",
        ".comment": "comment",
        ".status": "status",
        ".recitation": "recitation",
        ".email": {observe: "email_address",events: ["blur"]},
        ".user-id": {observe: "user_id",events: ["blur"]},
        ".password": "password",
        ".permission": {
          observe: "permission",
          selectOptions: { collection: function() { return config.permissions;}}
        }
      },

      saveAndAssign: function(){
        var save = this.saveAndAddStudent();
        if(save) {  // show the problem sets to assign to the users
          var user_ids = this.collection.pluck("user_id");
          var template = _.template($("#assign-to-users-template").html());
          this.$(".modal-body").html(template({user_ids: user_ids}));
          this.assignedSets = new Backbone.Model({sets: []})

          var bindings = {"#assign-to-users-select": {
              observe: "sets",
              selectOptions: {
                collection : this.problemSets.pluck("set_id"),
              }
          }}
          this.stickit(this.assignedSets,bindings);
          this.$(".action-button").addClass("hidden");
          this.$(".add-more-button").addClass("hidden");
          this.$(".save-button").removeClass("hidden");
        }
      },
      saveAndAddStudent: function (){
        var userExists = this.model.userExists(this.users);
        if(userExists){
          this.$(".message-pane").addClass("alert-danger").html(this.messageTemplate({type:"user_already_exists",
          opts: {users: [this.model.get("user_id")]}}));
          return false;
        }
        if(this.model.isValid(true)){
          this.collection.add(new User(this.model.attributes));
          this.$(".message-pane").addClass("alert-info").html(this.messageTemplate({type: "man_user_added",
          opts: {users: this.collection.pluck("user_id")}}));

          this.model.set(this.model.defaults);
          return true;
        }
        return false;
      },
      saveAndClose: function(){
        var self = this;
        var assignedSets = _(self.assignedSets.get("sets"));
        this.users.add(this.collection.models);
        this.collection.each(function(_user){_user.set("_id",_user.get("user_id"))});
        var sets = this.problemSets.chain().filter(function(_set){
          return assignedSets.contains(_set.get("set_id"))
        }).each(function(_set){
          _set.get("assigned_users").add(self.collection.models);
          _set.save();
        });

        this.collection.reset();

        this.close();
      }
    });

    var AddStudentFileView = ModalView.extend({
      initialize: function(options){
        _.bindAll(this, 'render','importStudents','validate'); // every function that uses 'this' as the current object should be in here
        _(this).extend(_(options).pick("users","messageTemplate"));
        _(this).bindAll("useFirstRow","hideShowEmail");
        this.collection = new UserList(); // this stores the users that will be added.
        Backbone.Validation.bind(this);
        this.model = new Backbone.Model({use_first_row: false, create_email: "none", email_suffix: ""});
        this.model.on("change:use_first_row",this.useFirstRow)
                .on("change:create_email",this.hideShowEmail);

        _(options).extend({
          modal_size: "modal-lg",
          modal_header: "Add Users from a File",
          modal_body: $("#add_student_file_dialog_content").html(),
          modal_buttons: $("#import-file-buttons").html()
        })
        ModalView.prototype.initialize.apply(this,[options]);
      },
      childEvents: {
        "click .import-students-button": "importStudents",
        "change input#useLST" : "setHeadersForLST",
        "click  .reload-file": "loadFile",
        "change #files": "loadFile",
        "change select.colHeader": "validate",
        "change #selectAllASW":  "selectAll",
        "change input.selRow":   "validate",
        "click  .close-button": function () { this.$(".help-pane").hide("slow");},
        "click  .cancel-button": "close",
        "click  .import-help-button": function () {this.$(".help-pane").removeClass("hidden").show("slow");},
        "click  .help-pane button": "closeHelpPane"
      },
      bindings: {
        "#use-first": "use_first_row",
        "#create-email": "create_email",
        "#email-suffix": "email_suffix",
      },
      closeErrorPane: function () {
        this.$(".error-pane").hide("slow");
      },
      showError: function(errorMessage){
        this.$(".error-pane").show("slow");
        this.$(".error-pane-text").text(errorMessage);
      },
      render: function(){
        ModalView.prototype.render.apply(this);
        this.stickit();
        return this;
      },
      loadFile: function (event) {
        var self = this;
        this.file = $("#files").get(0).files[0];
        $('#list').html('<em>' + escape(this.file.name) + '</em>');

        // Need to test if the browser can handle this new object.  If not, find alternative route.


        if (!(this.file.name.match(/\.(lst|csv)$/))){
          this.showError(this.messageTemplate({type: "csv_file_needed"}));
          return;
        }
        this.reader = new FileReader();

        this.reader.readAsText(this.file);
        this.reader.onload = function (evt) {
          var content = evt.target.result
          , headers = _(config.userProps).pluck("longName");
          headers.splice(0,0,"");
          // Parse the CSV file
          var arr = $.csv.toArrays(content);

          var tmpl = _.template($("#imported-from-file-table").html());
          $("#studentTable").html(tmpl({array: arr, headers: headers}));

          // build the table and set it up to scroll nicely.
          $("div.inner").width(25+($("#studentTable table thead td").length)*125);
          var w = $("#studentTable table thead td:nth-child(2)").width();
          $("#inner-table td").width(w+4).truncate({width: w-10});
          $("#inner-table td:nth-child(1)").width($("#studentTable table thead td:nth-child(1)").width())

          // test if it is a classlist file and then set the headers appropriately

          var re=new RegExp("\.lst$","i");
          if (re.test(self.file.name)){self.setHeadersForLST();}

          self.$(".import-students-button").removeClass("disabled");
          self.$(".reload-file").removeClass("disabled");
          $(".file-input-to-disable").removeAttr("disabled");
          self.delegateEvents();
        }
      },
      selectAll: function () {
        var self = this;
        this.$(".selRow").prop("checked",this.$("#selectAllASW").is(":checked"));
        if(this.model.get("use_first_row")){
          this.$("#cbrow0").prop("checked",false);
        }
        this.validate();
      },
      importStudents: function () {
        var self = this;
        if(this.validate()){
          this.collection.each(function(_user){
            self.users.add(_user);
          });
          this.close();
        }
      },
      hideShowEmail: function() {
        util.changeClass({els: this.$("#email-suffix").closest(".row"),
                          state: this.model.get("create_email")=="create_email",
                          remove_class: "hidden"});
      },
      useFirstRow: function (){
        var self = this;
        // If the useFirstRow checkbox is selected, try to match the first row to the headers.

        if (this.model.get("use_first_row")) {
          _(config.userProps).each(function(user,j){
            var re = new RegExp(user.regexp,"i");

            $("#studentTable thead td").each(function (i,head){
              if (re.test($("#inner-table tr:nth-child(1) td:nth-child(" + (i+1) + ")").html())) {
                $(".colHeader",head).val(user.longName);

              }
            });
          });
          this.validate();
        } else {  // set the headers to blank.
          $("#studentTable thead td").each(function (i,head){ $(".colheader",head).val("");});
          $("#inner-table tr").css("background-color","none");
        }
      },
      validate: function() {
        var self = this;
        var headers = this.$(".colHeader").map(function (i,col) { return $(col).val();});
        var loginCol = _(headers).indexOf("Login Name");
        var errorMessage = "";

        this.collection.reset();
        $("#inner-table td").removeClass("bg-danger"); // clear all previous errors.
        // check that the heads are unique

        var sortedHeads = _(headers).sortBy();
        var uniqueHeads = _.uniq(sortedHeads,true);

        if(! _.isEqual(sortedHeads,uniqueHeads)){
          var extraHeaders = _(sortedHeads).difference(uniqueHeads);
          errorMessage += "<li>" + this.messageTemplate({type: "duplicate_headers", opts: { headers: extraHeaders}}) + "</li>";
        }

        // check that "First Name", "Last Name" and "Login name" are among the chosen headers.

        var requiredHeaders = ["First Name","Last Name", "Login Name"];
        var containedHeaders = _(sortedHeads).intersection(requiredHeaders).sort();
        if (! _.isEqual(requiredHeaders,containedHeaders)) {
          errorMessage += "<li>" + this.messageTemplate({type: "required_headers", opts: { headers: requiredHeaders}}) + "</li>";
          this.$(".error-pane-text").html()
          this.$(".error-pane").show("slow");
          return;
        }

        // Determine the rows that have been selected.

        var colObj = _.object($(".colHeader").map(function(i,v){
            var x = _(config.userProps).findWhere({longName: $(v).val()});
            return _.isUndefined(x)?"":x.shortName;}),
          $(".colHeader").map(function(i,v){ return $(v).attr("id").split(/col/)[1]}));

        var rows = _.map($("input.selRow:checked"),function(val,i) {return parseInt(val.id.split("row")[1]);});
        _(rows).each(function(row){
          var props = {};
          _(config.userProps).each(function(obj){
            if(!_.isUndefined(colObj[obj.shortName])){
              props[obj.shortName] = $.trim($("tr#row"+row+" td.column" + colObj[obj.shortName]).html());
            }
            // create email or login/user_id if desired
            if(self.model.get("create_email") == "create_email"){
              props.email_address = props.user_id + self.model.get("email_suffix");
            } else if (self.model.get("create_email") == "create_login"){
              var email_parts = props.email.split("@");
              if (email_parts.length==2){
                props.user_id = email_parts[1];
              }
            }
          });

          // check that it is valid.
          var user = new User(props);
          delete user.id;  // make sure that the new users will be added with a POST instead of a PUT
          var errors = user.preValidate(props);
          if(errors){
            _(errors).chain().keys().each(function(key){
              errorMessage += "<li>" + self.messageTemplate({type: "input_error",
                  opts: { prop: key, val: props[key], msg: errors[key]}}) + "</li>";
              $("tr#row"+row+" td.column" + colObj[key]).addClass("bg-danger");
            });
          } else {
            self.collection.add(user);
          }
        });

        // Detect where the Login Name column is in the table and show duplicate entries of users.

        var imported_users = this.collection.pluck("user_id");
        var users_in_course = this.users.pluck("user_id");
        var duplicate_users = _.intersection(imported_users,users_in_course);

        if (loginCol < 0 ) {
          $("#inner-table tr#row").css("background","white");  // if Login Name is not a header turn off the color of the rows
        } else {

          var impUsers = $(".column" + loginCol).map(function (i,cell) {
            return $.trim($(cell).html());});


            // highlight where the duplicates users are and notify that there are duplicates.

            $(".column" + loginCol).each(function (i,cell) {
              if (_(duplicate_users).any(function (user) {
                return user.toLowerCase() == $.trim($(cell).html()).toLowerCase();}
              )){
                $("#inner-table tr#row" + i).addClass("duplicate-users");

              }
            });
            if(duplicate_users.length>0){
              errorMessage += "<li>" + self.messageTemplate({type: "user_already_exists", opts: {users: duplicate_users}}) + "</li>";
            }

          }

          if(!_.isEmpty(errorMessage)){
            $(".error-pane").removeClass("hidden").html("<ul>" + errorMessage +"</ul>");
            $(".import-students-button").addClass("disabled");
            return false;
          } else {
            $(".error-pane").addClass("hidden");
            $(".import-students-button").removeClass("disabled");
            return true;
          }

        },
        setHeadersForLST: function(){
          var self = this;
          _(config.userProps).each(function (prop,i) {
            var col = $("select#col"+i);
            col.val(prop.longName);
            self.validate(prop.longName);
          });
        }
      });


      return ClasslistView;

    });
