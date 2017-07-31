define(['backbone','views/Sidebar', 'config'],function(Backbone,Sidebar,config){
	var AllMesagesSidebar = Sidebar.extend({
		initialize: function(options){
			Sidebar.prototype.initialize.apply(this,[options]);
			this.messages = options.messages;
			_(this).bindAll("render");
		},
		set: function(options){
			this.messages = options.messages;
			this.messages.on("add remove change",this.render);
		},
	    render: function(){
	    	if(typeof(this.$el)==="undefined"){
	    		return;
	    	}
	        this.$el.html($("#all-messages-template").html());
	        var messageViewTemplate = $("#message-view-template").html();
	        var ul = this.$(".messages-list");
	        this.messages.each(function(message){
	        	ul.append(new MessageView({model: message}).render().el);
	        })

	        Sidebar.prototype.render.apply(this);
	        return this;

	    }
	});

	var MessageView = Backbone.View.extend({
		tagName: "li",
    longMessageTemplate: _.template($("#long-message-template").html()),
		render: function(){
      this.$el.addClass("text-" + this.model.get("type"));
			this.$el.html(this.longMessageTemplate({text: this.model.get("text"),
              time: this.model.get("date_created").format("h:mm a")}));
			return this;
		},


	});

	return AllMesagesSidebar;
});
