(function(){

var views = sfp.views = {};

var View = views.View = function(selection, layout) {
  this.selection = selection;
  this.layout = layout;
  this.initialize.apply(this, arguments);
};

_.extend(View.prototype, Backbone.Events, {
  initialize: function(){
    this._dataHistory = [];

    if (this.layout.transform) {
      this.selection.attr('transform', this.layout.transform);
    };
  },

  render: function(){
    this.updateContext();
  },

  update: function(data){
    if (data) {
      this.data = data;
      this._dataHistory.unshift(this.data);
    };

    if (!this.rendered) {
      this.rendered = true;
      this.render();
    };
  },

  updateContext: function(){}
});

View.extend = Backbone.View.extend;

}).call(this);
