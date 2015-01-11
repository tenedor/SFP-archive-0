(function(){

var views = sfp.views;
var View = views.View;

var PlotComponent = views.PlotComponent = View.extend({

  updateContext: function(){
    var cld, id, indexWidthUnit;

    // height of one code line (code line domain is an inclusive range, so add 1
    // in span calculation account for flow point size)
    cld = this.codeLinesDomain = this.data.codeLinesDomain;
    this.codeLineHeightUnit = this.layout.height / (cld[1] - cld[0] + 1);

    // width of a length-1 index interval (index domain already accounts for
    // flow point widths, so do not add 1 in span calculation)
    id = this.indexDomain = this.data.indexDomain;
    indexWidthUnit = this.layout.width / (id[1] - id[0]);
    this.indexWidthUnit = _.isFinite(indexWidthUnit) ? indexWidthUnit : NaN;
  }

});

}).call(this);
