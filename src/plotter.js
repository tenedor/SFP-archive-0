/*
 * `flowPoints` data is an array of `flowPoint` arrays.
 *
 * Each `flowPoint` array has length 9 and follows the format:
 *   [step/uid, index, length, timeEnter, timeExit, filename, codeLineNumber,
 *      codeLine, [sideEffect, ...]]
 * Or, in terms of types:
 *   [int, int, int, float, float, string, int, string, [string, ...]]
 * More verbosely:
 *   step/uid (int): the ordinal index of this point and its unique ID
 *   index (int): the plot position for this point (depends on the index mode)
 *   length (int): the plot length for this point (depends on the index mode)
 *   timeEnter (float): the elapsed time when this point's evaluation began
 *   timeExit (float): the elapsed time when this point's evaluation ended
 *   filename (string): the name of the file this point belongs to
 *   codeLineNumber (int): the file's line number this point represents
 *   codeLine (string): the text of the line of code this point represents
 *   sideEffects (strings array): a list of side effects occurring at this point
 */


(function(){

var util = sfp.util;
var views = sfp.views;
var View = views.View;
var PlotComponent = views.PlotComponent;

var plotter = sfp.plotter = {};

var STEP = 0;
var UID = STEP;
var INDEX = 1;
var LENGTH = 2;
var TIME_ENTER = 3;
var TIME_EXIT = 4;
var FILENAME = 5;
var CODE_LINE_NUMBER = 6;
var CODE_LINE = 7;
var SIDE_EFFECTS = 8;

_.extend(plotter, Backbone.Events, {
  originalData: null,
  filteredData: null,
  indexedData: null,
  filter: {},
  indexMode: null,

  // layout configs
  LAYOUT: {
    svg: {
      height: 560, width: 560, transform: '',
      plot: {
        height: 450, width: 550, transform: 'translate(50, 10)',
        indexAxis: {
          height: 50, width: 500, transform: 'translate(0, 400)',
          indexNumbers: {height: 15, width: 500, transform: 'translate(0, 20)'}
        },
        codeLineAxis: {
          height: 400, width: 50, transform: 'translate(-50, 0)',
          codeLineNumbers: {
            height: 400, width: 15, transform: 'translate(35, 0)'
          }
        },
        plotBody: {
          height: 400, width: 500, transform: '',
          codeLines: {height: 400, width: 400, transform: ''},
          barSelectorsContainer: {
            height: 400, width: 500, transform: '',
            indexBarSelectors: {height: 400, width: 500, transform: ''},
            codeBarSelectors: {height: 400, width: 500, transform: ''}
          },
          flowPoints: {height: 400, width: 500, transform: ''}
        }
      },
      codeText: {height: 100, width: 500, transform: 'translate(50, 460)'}
    }
  }
});


// Set Up
// ------

// retrieve, parse, and set up data
$(document).ready(function(){
  $.getJSON('data/coins.py.extract.json', function(data){
    plotter.originalData = {
      flowPoints: _.map(data.lines, function(flowPoint, index) {
        flowPoint[0] = parseFloat(flowPoint[0]); // time enter
        flowPoint[1] = parseFloat(flowPoint[1]); // time exit
        flowPoint[3] = parseInt(flowPoint[3]);   // line number
        flowPoint.unshift(0.8);                  // default length (step mode)
        flowPoint.unshift(index);                // default index (step mode)
        flowPoint.unshift(index);                // step index and unique id
        return flowPoint;
      })
    };
    initialize();
  });
})


var initialize = function() {
  initializeData();
  initializePlot();
  initializeListeners();
  initializeAuxiliaryLayout();
  setTimeout(updatePlot, 250);
};


var initializeData = function() {
  plotter.filter = {};
  filterData({silent: true});

  plotter.indexMode = 'step';
  indexData({silent: true});
};


var initializePlot = function() {
  var layout, svg;

  // svg
  layout = plotter.LAYOUT.svg;
  svg = d3.select('.svg-container > svg')
    .attr('width', layout.width)
    .attr('height', layout.height);
    //.attr('viewbox', '0, 0, 100, 100');

  plotter.plot = new views.Plot(svg.select('g.plot'), layout.plot);
  plotter.codeText = new views.CodeText(svg.select('text.code-text'),
      layout.codeText);
};


var initializeListeners = function() {
  plotter.on('filter:changed', filterData);
  plotter.on('filteredData:changed', indexData);
  plotter.on('indexMode:changed', indexData);
  plotter.on('indexedData:changed', updatePlot);
};


var initializeAuxiliaryLayout = function() {
  // listen for index mode changes
  $('.index-mode-buttons > button').on('click', function() {
    var indexMode = $(this).attr('data-index-mode');
    updateIndexMode(indexMode);
  });

  // update index button display
  $('.index-mode-buttons > button[data-index-mode=' + plotter.indexMode + ']')
      .addClass('selected');

  // listen for filter updates
  $('input.filter').on('keyup', function(event) {
    var filter;
    if (event.keyCode === util.keys.ENTER) {
      filter = parseFilterInput();
      if (filter.valid) {
        updateFilter(filter);
      } else {
        $('input.filter').addClass('error');
        setTimeout(function(){$('input.filter').removeClass('error')}, 0);
      };
    };
  });
};


var parseFilterInput = function() {
  var filter, filterStrings, linesRE, i, filterString, j, linesFilter, start,
      end;
  filter = {lines: [], valid: true};
  filterStrings = $('input.filter').val().split(';');
  linesRE = /^ *lines:? ([0-9][0-9\-, ]*)$/;
  for (i = 0; i < filterStrings.length; i++) {
    if (! filterStrings[i].trim()) {
      continue;
    };
    filterString = filterStrings[i].match(linesRE);
    if (filterString) {
      filterString = filterString[1].split(',');
      for (j = 0; j < filterString.length; j++) {
        linesFilter = filterString[j].match(/([0-9]+)-?([0-9]+)?/);
        if (linesFilter) {
          start = linesFilter[1];
          end = linesFilter[2] || linesFilter[1];
          filter.lines.push([start, end]);
        } else {
          filter.valid = false;
        };
      };
    } else {
      filter.valid = false;
    };
  };
  return filter;
};


var updateFilter = function(filter, options) {
  if (plotter.filter !== filter) {
    plotter.filter = filter;

    if (!(options && options.silent)) {
      plotter.trigger('filter:changed');
    };
  };
};


var updateIndexMode = function(indexMode, options) {
  $('.index-mode-buttons > button').removeClass('selected');
  $('.index-mode-buttons > button[data-index-mode=' + indexMode + ']')
      .addClass('selected');

  if (plotter.indexMode !== indexMode) {
    plotter.indexMode = indexMode;

    if (!(options && options.silent)) {
      plotter.trigger('indexMode:changed');
    };
  };
};


var filterFn = function(flowPoints) {
  var filter, max;

  filter = plotter.filter;
  if (_.isArray(filter.lines) && filter.lines.length) {
    min = filter.lines[0][0];
    max = filter.lines[0][1];
    flowPoints = _.filter(flowPoints, function(flowPoint) {
      return (min <= flowPoint[CODE_LINE_NUMBER] &&
          flowPoint[CODE_LINE_NUMBER] <= max);
    });
  };

  return flowPoints;
};


var filterData = function(options) {
  var originalFlowPoints, flowPoints;

  // TODO: "protect" originalData by limiting access through a cloning getter
  originalFlowPoints = util.nLevelClone(plotter.originalData.flowPoints, 2);
  flowPoints = filterFn(originalFlowPoints);

  plotter.filteredData = {
    flowPoints: flowPoints
  };

  if (!(options && options.silent)) {
    plotter.trigger('filteredData:changed');
  };
};


var indexData = function(options) {
  var filteredFlowPoints, indexFn, flowPoints, codeLinesMin, codeLines, i,
      codeLine, codeLinesMax, _codeLines;

  // index flow points
  filteredFlowPoints = util.nLevelClone(plotter.filteredData.flowPoints, 2);
  indexFn = plotter.INDICES[plotter.indexMode].fn;
  flowPoints = indexFn(filteredFlowPoints);

  // extract original code
  codeLinesMin = Infinity;
  codeLines = [];
  for (i = 0; i < flowPoints.length; i++) {
    codeLine = {
      codeLineNumber: flowPoints[i][CODE_LINE_NUMBER],
      codeText: flowPoints[i][CODE_LINE]
    };
    codeLines[flowPoints[i][CODE_LINE_NUMBER]] = codeLine;
    codeLinesMin = Math.min(codeLinesMin, flowPoints[i][CODE_LINE_NUMBER]);
  };
  codeLinesMax = codeLines.length - 1;

  // clean up codeLines
  _codeLines = codeLines;
  codeLines = [];
  for (i = codeLinesMin; i < _codeLines.length; i++) {
    codeLine = _codeLines[i] || {
      codeLineNumber: i,
      codeText: ''
    };
    codeLines.push(codeLine);
  };

  // calculate index dimensions
  indexMinPoint = _.min(flowPoints, function(flowPoint){
    return flowPoint[INDEX];});
  indexMaxPoint = _.max(flowPoints, function(flowPoint){
    return flowPoint[INDEX] + flowPoint[LENGTH];});
  indexMin = indexMinPoint[INDEX];
  indexMax = indexMaxPoint[INDEX] + indexMaxPoint[LENGTH];

  plotter.indexedData = {
    flowPoints: flowPoints,
    codeLines: codeLines,
    codeLinesDomain: [codeLinesMin, codeLinesMax],
    indexDomain: [indexMin, indexMax],
    index: plotter.INDICES[plotter.indexMode]
  };

  if (!(options && options.silent)) {
    plotter.trigger('indexedData:changed');
  };
};


var stepIndexed = function(dataPoints) {
  return _.map(dataPoints, function(dataPoint) {
    dataPoint[INDEX] = dataPoint[STEP];
    dataPoint[LENGTH] = 0.8;
    return dataPoint;
  });
};


var timeIndexed = function(dataPoints) {
  return _.map(dataPoints, function(dataPoint) {
    dataPoint[INDEX] = dataPoint[TIME_ENTER];
    dataPoint[LENGTH] = dataPoint[TIME_EXIT] - dataPoint[TIME_ENTER];
    return dataPoint;
  });
};


var stackedBarIndexed = function(dataPoints) {
  barHeights = [];
  return _.map(dataPoints, function(dataPoint) {
    var codeLineNumber = dataPoint[CODE_LINE_NUMBER];
    if (! barHeights[codeLineNumber]) {
      barHeights[codeLineNumber] = 0;
    };
    dataPoint[INDEX] = barHeights[codeLineNumber]++;
    dataPoint[LENGTH] = 0.8;
    return dataPoint;
  });
};


plotter.INDICES = {
  step: {fn: stepIndexed, discrete: true, axisLabel: 'step'},
  time: {fn: timeIndexed, discrete: false, axisLabel: 'elapsed time'},
  histogram: {fn: stackedBarIndexed, discrete: true, axisLabel: 'step count'}
};


var Plot = views.Plot = PlotComponent.extend({

  initialize: function() {
    PlotComponent.prototype.initialize.apply(this, arguments);

    this.indexAxis = new views.IndexAxis(
        this.selection.select('.index-axis'),
        this.layout.indexAxis);
    this.codeLineAxis = new views.CodeLineAxis(
        this.selection.select('.code-axis'),
        this.layout.codeLineAxis);
    this.plotBody = new views.PlotBody(
        this.selection.select('.plot-body'),
        this.layout.plotBody);
  },

  render: function() {
    var selector = '[data-code-line-number]';
    this.selection
      .delegate('mouseenter', selector, onMouseEnterCodeLineNumber)
      .delegate('mouseleave', selector, onMouseLeaveCodeLineNumber);
  },

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    this.indexAxis.update(data);
    this.codeLineAxis.update(data);
    this.plotBody.update(data);
  }

});


var IndexAxis = views.IndexAxis = PlotComponent.extend({

  initialize: function() {
    PlotComponent.prototype.initialize.apply(this, arguments);

    // index axis
    this.selection.append('rect')
      .classed('axis-bar', true)
      .attr('x', 0)
      .attr('y', 5)
      .attr('width', this.layout.width + 1) // '+1' handles zero-length points
      .attr('height', '5');
    this.selection.append('g')
      .classed('axis-label-container', true);

    // index axis label
    this.labelSelection = this.selection.select('g.axis-label-container');

    this.indexNumbers = new views.IndexNumbers(
        this.selection.select('.index-numbers'),
        this.layout.indexNumbers);
  },

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var indexAxisLabel, indexAxisLabelText;

    indexAxisLabelText = this.data.index.axisLabel;

    indexAxisLabel = this.labelSelection.selectAll('text')
      .data([indexAxisLabelText], String);
    indexAxisLabel.enter().append('text')
      .classed('axis-label', true)
      .classed('index-axis-label', true)
      .text(String)
      .attr('text-anchor', 'middle')
      .attr('x', this.layout.width / 2)
      .attr('y', 40)
      .style('opacity', 0);
    indexAxisLabel.transition().duration(700)
      .style('opacity', 1);
    indexAxisLabel.exit().transition().duration(700)
      .style('opacity', 0)
      .remove();

    this.indexNumbers.update(data);
  }

});


var IndexNumbers = views.IndexNumbers = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var indexNumber, layout, indexNumberValues, indexDomain, indexWidthUnit;

    layout = this.layout;
    indexNumberValues = util.axisNumbersForDomain(this.data.indexDomain,
        this.data.index.discrete);
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    // TODO: center index number positions on the flow points they index
    indexNumber = this.selection.selectAll('tspan.index-number')
      .data(indexNumberValues, parseFloat);
    indexNumber.enter().append('tspan')
      .classed('index-number', true)
      .classed('axis-number', true)
      .text(function(indexValue){return indexValue;})
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .attr('data-index-number', function(indexValue){return indexValue;})
      .attr('x', function(indexValue){
        return (indexValue - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', 0)
      .on('mouseenter', onMouseEnterIndexNumber)
      .on('mouseleave', onMouseLeaveIndexNumber)
      .style('opacity', 0);

    // update axis descriptors to transition to the correct location
    this.updateContext();
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    indexNumber.transition().duration(700)
      .attr('x', function(indexValue){
        return (indexValue - indexDomain[0]) * indexWidthUnit || 0;})
      .style('opacity', 1);
    indexNumber.exit().transition().duration(700)
      .attr('x', function(indexValue){
        return (indexValue - indexDomain[0]) * indexWidthUnit || 0;})
      .style('opacity',0)
      .remove();
  }

});


var CodeLineAxis = views.CodeLineAxis = PlotComponent.extend({

  initialize: function() {
    PlotComponent.prototype.initialize.apply(this, arguments);

    this.selection.append('rect')
      .classed('axis-bar', true)
      .attr('x', this.layout.width - 10)
      .attr('y', 0)
      .attr('width', 5)
      .attr('height', this.layout.height);
    this.selection.append('g')
      .classed('axis-label-container', true);
    this.selection.select('g').append('text')
      .classed('axis-label', true)
      .classed('code-axis-label', true)
      .text('coins.py')
      .attr('text-anchor', 'middle')
      .attr('x', -this.layout.height / 2)
      .attr('y', 0)
      .attr('transform', 'rotate(270) translate(0, 10)');

    this.codeLineNumbers = new views.CodeLineNumbers(
        this.selection.select('.code-line-numbers'),
        this.layout.codeLineNumbers);
  },

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    this.codeLineNumbers.update(data);
  }

});


var CodeLineNumbers = views.CodeLineNumbers = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var codeLineNumber, layout, codeLines, codeLinesDomain, codeLinesHeightUnit;

    layout = this.layout;
    codeLines = this.data.codeLines;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeLineNumber = this.selection.selectAll('tspan.code-line-number')
      .data(codeLines, function(codeLine) {
        return codeLine && codeLine.codeLineNumber || 0});
    codeLineNumber.enter().append('tspan')
      .classed('code-line-number', true)
      .classed('axis-number', true)
      .text(function(codeLine){
        return codeLine && codeLine.codeLineNumber || null;})
      .attr('text-anchor', 'end')
      .attr('alignment-baseline', 'middle')
      .attr('data-code-line-number', function(codeLine){
        return codeLine && codeLine.codeLineNumber || null;})
      .attr('x', 0)
      .attr('y', function(codeLine){
        if (codeLine && codeLine.codeLineNumber) {
          return (codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;}
        else {
          return null;}})
      .style('opacity', 0);

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeLineNumber.transition().duration(700)
      .attr('y', function(codeLine){
        if (codeLine && codeLine.codeLineNumber) {
          return (codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;}
        else {
          return null;}})
      .style('opacity', 1);
    codeLineNumber.exit().transition().duration(700)
      .attr('y', function(codeLine){
        if (codeLine && codeLine.codeLineNumber) {
          return (codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;}
        else {
          return null;}})
      .style('opacity', 0)
      .remove();
  }

});


var PlotBody = views.PlotBody = PlotComponent.extend({

  initialize: function() {
    PlotComponent.prototype.initialize.apply(this, arguments);

    this.barSelectorsContainer = new views.BarSelectorsContainer(
        this.selection.select('.bar-selectors-container'),
        this.layout.barSelectorsContainer);

    this.flowPoints = new views.FlowPoints(
        this.selection.select('.flow-points'),
        this.layout.flowPoints);

    this.codeLines = new views.CodeLines(
        this.selection.select('.code-lines'),
        this.layout.codeLines);
  },

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    this.barSelectorsContainer.update(data);
    this.flowPoints.update(data);
    this.codeLines.update(data);
  }

});


var CodeLines = views.CodeLines = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var codeLine, enteredCodeLine, layout, codeLines, codeLinesDomain,
        codeLineHeightUnit;

    layout = this.layout;
    codeLines = this.data.codeLines;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeLine = this.selection.selectAll('tspan.code-line')
      .data(codeLines, function(codeLine) {
        return codeLine && codeLine.codeLineNumber || 0});
    enteredCodeLine = codeLine.enter().append('tspan')
      .classed('code-line', true)
      .attr('data-code-line-number', function(codeLine){
        return codeLine && codeLine.codeLineNumber || null;})
      .attr('x', 0)
      .attr('y', function(codeLine){
        if (codeLine && codeLine.codeLineNumber) {
          return (codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;}
        else {
          return null;}})
      .style('opacity', 0);
    enteredCodeLine.append('tspan')
      .classed('transparent', true)
      .classed('code-line-indentation', true)
      .text(function(codeLine) {
        // use transparent `#` markers to preserve whitespace
        var whitespaceLength;
        codeLine = (codeLine && codeLine.codeText || '');
        whitespaceLength = codeLine.length - codeLine.trimLeft().length;
        return Array(whitespaceLength + 1).join('#');})
      .attr('alignment-baseline', 'middle');
    enteredCodeLine.append('tspan')
      .classed('code-line-text', true)
      .text(function(codeLine) {
        return (codeLine && codeLine.codeText || '').trimLeft();})
      .attr('alignment-baseline', 'middle');

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeLine.transition().duration(700)
      .attr('y', function(codeLine){
        if (codeLine && codeLine.codeLineNumber) {
          return (codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;}
        else {
          return null;}})
      .style('opacity', 1);
    codeLine.exit().transition().duration(700)
      .attr('y', function(codeLine){
        if (codeLine && codeLine.codeLineNumber) {
          return (codeLine.codeLineNumber - codeLinesDomain[0] + 0.5) * codeLineHeightUnit;}
        else {
          return null;}})
      .style('opacity', 0)
      .remove();
  }

});


var BarSelectorsContainer = views.BarSelectorsContainer = PlotComponent.extend({

  initialize: function() {
    PlotComponent.prototype.initialize.apply(this, arguments);

    this.indexBarSelectors = new views.IndexBarSelectors(
        this.selection.select('.index-bar-selectors'),
        this.layout.indexBarSelectors);

    this.codeBarSelectors = new views.CodeBarSelectors(
        this.selection.select('.code-bar-selectors'),
        this.layout.codeBarSelectors);
  },

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    this.indexBarSelectors.update(data);
    this.codeBarSelectors.update(data);
  }

});


// TODO
var IndexBarSelectors = views.IndexBarSelectors = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var indexBar, layout, indexNumberValues, indexDomain, indexWidthUnit;

    layout = this.layout;
    indexNumberValues = util.axisNumbersForDomain(this.data.indexDomain,
        this.data.index.discrete);
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    indexBar = this.selection.selectAll('rect.index-bar-selector')
      .data(indexNumberValues, parseFloat);
    indexBar.enter().append('rect')
      .classed('index-bar-selector', true)
      .classed('bar-selector', true)
      .attr('data-index-number', function(indexValue){return indexValue;})
      .attr('x', function(indexValue){
        return (indexValue - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', 0)
      .attr('width', this.layout.width / indexNumberValues.length)
      .attr('height', this.layout.height)
      .on('mouseenter', onMouseEnterIndexNumber)
      .on('mouseleave', onMouseLeaveIndexNumber);

    this.updateContext();
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    indexBar.exit().transition().duration(700)
      .remove();
  }

});


var CodeBarSelectors = views.CodeBarSelectors = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var codeBar, layout, codeLines, codeLinesDomain, codeLinesHeightUnit;

    layout = this.layout;
    codeLines = this.data.codeLines;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeBar = this.selection.selectAll('rect.code-bar-selector')
      .data(codeLines, function(codeLine) {
        return codeLine && codeLine.codeLineNumber || 0});
    codeBar.enter().append('rect')
      .classed('code-bar-selector', true)
      .classed('bar-selector', true)
      .attr('data-code-line-number', function(codeLine){
        return codeLine && codeLine.codeLineNumber || null;})
      .attr('x', 0)
      .attr('y', function(codeLine){
        if (codeLine && codeLine.codeLineNumber) {
          return (codeLine.codeLineNumber - codeLinesDomain[0]) * codeLineHeightUnit;}
        else {
          return null;}})
      .attr('width', this.layout.width)
      .attr('height', codeLineHeightUnit);

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;

    codeBar.transition().duration(700)
      .attr('y', function(codeLine){
        if (codeLine && codeLine.codeLineNumber) {
          return (codeLine.codeLineNumber - codeLinesDomain[0]) * codeLineHeightUnit;}
        else {
          return null;}})
      .attr('height', codeLineHeightUnit);
    codeBar.exit().transition().duration(700)
      .attr('y', function(codeLine){
        if (codeLine && codeLine.codeLineNumber) {
          return (codeLine.codeLineNumber - codeLinesDomain[0]) * codeLineHeightUnit;}
        else {
          return null;}})
      .attr('height', codeLineHeightUnit)
      .remove();
  }

});


var FlowPoints = views.FlowPoints = PlotComponent.extend({

  update: function(data) {
    PlotComponent.prototype.update.apply(this, arguments);

    var flowPoint, layout, flowPoints, codeLines, codeLinesDomain,
        codeLineHeightUnit, indexDomain, indexWidthUnit;

    layout = this.layout;
    flowPoints = this.data.flowPoints;
    codeLines = this.data.codeLines;
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    flowPoint = this.selection.selectAll('rect.flow-point')
      .data(flowPoints, function(d){return d[UID];});
    flowPoint.enter().append('rect')
      .classed('flow-point', true)
      .classed('has-side-effect', function(flowPoint) {
        return !!flowPoint[SIDE_EFFECTS].length;})
      .attr('data-code-line-number', function(flowPoint){
        return flowPoint[CODE_LINE_NUMBER];})
      .attr('x', function(flowPoint, i) {
        return (flowPoint[INDEX] - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint[CODE_LINE_NUMBER] - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(flowPoint) {
        return flowPoint[LENGTH] * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit)
      .style('opacity', 0)
      .on('mouseenter', onMouseEnterFlowPoint)
      .on('mouseleave', onMouseLeaveFlowPoint);

    this.updateContext();
    codeLinesDomain = this.codeLinesDomain;
    codeLineHeightUnit = this.codeLineHeightUnit;
    indexDomain = this.indexDomain;
    indexWidthUnit = this.indexWidthUnit;

    flowPoint.transition().duration(700)
      .attr('x', function(flowPoint, i) {
        return (flowPoint[INDEX] - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint[CODE_LINE_NUMBER] - codeLinesDomain[0]) * codeLineHeightUnit;})
      .attr('width', function(flowPoint) {
        return flowPoint[LENGTH] * indexWidthUnit || 1;})
      .attr('height', codeLineHeightUnit)
      .style('opacity', 1);
    flowPoint.exit().transition().duration(700)
      .attr('x', function(flowPoint, i) {
        return (flowPoint[INDEX] - indexDomain[0]) * indexWidthUnit || 0;})
      .attr('y', function(flowPoint){
        return (flowPoint[CODE_LINE_NUMBER] - codeLinesDomain[0]) * codeLineHeightUnit;})
      .style('opacity', 0)
      .remove();
  }

});


var CodeText = views.CodeText = View.extend({

  update: function(data) {
    View.prototype.update.apply(this, arguments);

    var codeLinesDomain, codeLines, activeCodeLineNumber, min, max,
        nearbyCodeLines, codeTextLine;

    codeLinesDomain = this.data.codeLinesDomain;
    codeLines = this.data.codeLines;
    activeCodeLineNumber = this.activeCodeLineNumber;

    // get code lines nearby the given code line number
    min = Math.max(codeLinesDomain[0], activeCodeLineNumber - 2);
    max = Math.min(codeLinesDomain[1], min + 4);
    if (max - min < 5) {
      min = Math.max(codeLinesDomain[0], max - 4);
    };

    nearbyCodeLines = _.filter(codeLines, function(codeLine) {
      return min <= codeLine.codeLineNumber && codeLine.codeLineNumber <= max;
    });

    codeTextLine = this.selection.selectAll('tspan.code-text-line')
      .data(nearbyCodeLines, function(codeLine){
        return codeLine.codeLineNumber;});
    codeTextLine.enter().insert('tspan')
      .classed('code-text-line', true)
      .attr('opacity', function(codeLine) {
        return codeLine.codeText.trim() ? null : 0;})
      .attr('x', 0)
      .attr('dy', '1.2em')
      .text(function(codeLine){return codeLine.codeText.trim() || '#';});
    codeTextLine
      .classed('selected', function(codeLine) {
        return codeLine.codeLineNumber === activeCodeLineNumber;});
    codeTextLine.exit().remove();
  },

  activateCodeLine: function(codeLineNumber, data) {
    var activeCodeLineNumber = parseInt(codeLineNumber);

    if (_.isFinite(activeCodeLineNumber)) {
      this.activeCodeLineNumber = activeCodeLineNumber;
      this.update(data);
    };
  }

});



// Plot Management
// ---------------

var updatePlot = plotter.updatePlot = function() {
  // TODO: handle case where the filter has selected no flow points
  plotter.plot.update(plotter.indexedData);
};


var selectCodeLineNumber = function(codeLineNumber) {
  if (!codeLineNumber) return;

  d3.selectAll('[data-code-line-number="' + codeLineNumber + '"]')
    .classed('selected', true);

  plotter.codeText.activateCodeLine(codeLineNumber, plotter.indexedData);
};


var unselectCodeLineNumber = function(codeLineNumber) {
  if (!codeLineNumber) return;

  d3.selectAll('[data-code-line-number="' + codeLineNumber + '"]')
    .classed('selected', false);
};


var selectIndexNumber = function(indexNumber) {
  d3.selectAll('[data-index-number="' + indexNumber + '"]')
    .classed('selected', true);
};


var unselectIndexNumber = function(indexNumber) {
  d3.selectAll('[data-index-number="' + indexNumber + '"]')
    .classed('selected', false);
};


// DOM Event Handlers
// --------------

var onMouseEnterCodeLineNumber = function(data) {
  selectCodeLineNumber(d3.select(this).attr('data-code-line-number'));
};

var onMouseLeaveCodeLineNumber = function(data) {
  unselectCodeLineNumber(d3.select(this).attr('data-code-line-number'));
};

var onMouseEnterIndexNumber = function(data) {
  //selectIndexNumber(d3.select(this).attr('data-index-number'));
};

var onMouseLeaveIndexNumber = function(data) {
  //unselectIndexNumber(d3.select(this).attr('data-index-number'));
};


var onMouseEnterFlowPoint = function(flowPoint) {
  if (flowPoint[SIDE_EFFECTS]) {
    d3.select('.side-effect')
      .text(flowPoint[SIDE_EFFECTS][0])
      .classed('transparent', false);
  };
};


var onMouseLeaveFlowPoint = function(flowPoint) {
  d3.select('.side-effect').classed('transparent', true);
};

}).call(this);
