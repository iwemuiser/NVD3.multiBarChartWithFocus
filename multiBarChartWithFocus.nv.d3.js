// Adjusted for Nederlab by Iwe Muiser

(function() {
  nv.models.multiBarChartWithFocus = function() {
      "use strict";

      //============================================================
      // Public Variables with Default Settings
      //------------------------------------------------------------

      var multibar = nv.models.multiBar()
          , bars2 = nv.models.multiBar()
          , xAxis = nv.models.axis()
          , x2Axis = nv.models.axis()
          , yAxis = nv.models.axis()
          , y2Axis = nv.models.axis()
          , interactiveLayer = nv.interactiveGuideline()
          , legend = nv.models.legend()
          , brush = d3.svg.brush()
          , controls = nv.models.legend()
          , tooltip = nv.models.tooltip()
          ;

      var margin = {top: 30, right: 20, bottom: 50, left: 60}
          , margin2 = {top: 0, right: 30, bottom: 20, left: 60}
          , width = null
          , height = null
          , getX = function(d) { return d.x }
          , getY = function(d) { return d.y }
          , color = nv.utils.defaultColor()
          , showControls = true
          , controlLabels = {}
          , showLegend = true
          , showXAxis = true
          , showYAxis = true
          , rightAlignYAxis = false
          , reduceXTicks = true // if false a tick will show for every data point
          , staggerLabels = false
          , wrapLabels = false
            , focusEnable = true
          , focusShowAxisY = false
          , focusShowAxisX = true
          , focusHeight = 80
          , extent
          , brushExtent = null
            , rotateLabels = 0
          , x //can be accessed via chart.xScale()
          , y //can be accessed via chart.yScale()
          , x2
          , y2
          , state = nv.utils.state()
          , defaultState = null
          , noData = null
          , dispatch = d3.dispatch('brush', 'stateChange', 'changeState', 'renderEnd')
          , transitionDuration = 0
          , controlWidth = function() { return showControls ? 180 : 0 }
          , duration = 250
          , useInteractiveGuideline = false
          ;

      state.stacked = false // DEPRECATED Maintained for backward compatibility

      multibar.stacked(false);

      xAxis.orient('bottom')
          .tickPadding(5)
          .showMaxMin(true)
          .tickFormat(function(d) { return d });

      yAxis.orient((rightAlignYAxis) ? 'right' : 'left')
          .tickFormat(d3.format(',.1f'));

      tooltip.duration(0)
          .valueFormatter(function(d, i) {
              return yAxis.tickFormat()(d, i);
          })
          .headerFormatter(function(d, i) {
              return xAxis.tickFormat()(d, i);
          });

      controls.updateState(false);

      //============================================================
      // Private Variables
      //------------------------------------------------------------

      var renderWatch = nv.utils.renderWatch(dispatch);
      var stacked = false;

      var stateGetter = function(data) {
          return function(){
              return {
                  active: data.map(function(d) { return !d.disabled }),
                  stacked: stacked
              };
          }
      };

      var stateSetter = function(data) {
          return function(state) {
              if (state.stacked !== undefined)
                  stacked = state.stacked;
              if (state.active !== undefined)
                  data.forEach(function(series,i) {
                      series.disabled = !state.active[i];
                  });
          }
      };

      function chart(selection) {
          renderWatch.reset();
          renderWatch.models(multibar);

          if (showXAxis) renderWatch.models(xAxis);
          if (showYAxis) renderWatch.models(yAxis);

          selection.each(function(data) {
              var container = d3.select(this),
                  that = this;
              nv.utils.initSVG(container);
              var availableWidth = nv.utils.availableWidth(width, container, margin),
                  availableHeight = nv.utils.availableHeight(height, container, margin)
                      - (focusEnable ? focusHeight : 0),
                  availableHeight2 = focusHeight - margin2.top - margin2.bottom;

              chart.update = function() {
                  if (duration === 0)
                      container.call(chart);
                  else
                      container.transition()
                          .duration(duration)
                          .call(chart);
              };
              chart.container = this;

              state
                  .setter(stateSetter(data), chart.update)
                  .getter(stateGetter(data))
                  .update();

              // DEPRECATED set state.disableddisabled
              state.disabled = data.map(function(d) { return !!d.disabled });

              if (!defaultState) {
                  var key;
                  defaultState = {};
                  for (key in state) {
                      if (state[key] instanceof Array)
                          defaultState[key] = state[key].slice(0);
                      else
                          defaultState[key] = state[key];
                  }
              }

              // Display noData message if there's nothing to show.
              if (!data || !data.length || !data.filter(function(d) { return d.values.length }).length) {
                  nv.utils.noData(chart, container)
                  return chart;
              } else {
                  container.selectAll('.nv-noData').remove();
              }

              // Setup Scales
              var dataBars = data.filter(function(d) { return !d.disabled && d.bar });

              x = multibar.xScale();
              x2 = x2Axis.scale();

              // select the scales and series based on the position of the yAxis
              y = multibar.yScale();
              y2 = bars2.yScale();

              //to make sure all hidden data is shown as well:
              var series1 = data
                  .filter(function(d) { return !d.disabled && (d.bar) })
                  .map(function(d) {
                      return d.values.map(function(d,i) {
                          return { x: getX(d,i), y: getY(d,i) }
                      })
                  });

              var series2 = data
                  .filter(function(d) { return !d.disabled && (!d.bar) })
                  .map(function(d) {
                      return d.values.map(function(d,i) {
                          return { x: getX(d,i), y: getY(d,i) }
                      })
                  });

              x.range([0, availableWidth]);

              x2  .domain(d3.extent(d3.merge(series1.concat(series2)), function(d) { return d.x } ))
                  .range([0, availableWidth]);

              // Setup containers and skeleton of chart
              var wrap = container.selectAll('g.nv-wrap.nv-multiBarWithFocus').data([data]);
              var gEnter = wrap.enter().append('g').attr('class', 'nvd3 nv-wrap nv-multiBarWithFocus').append('g');
              var g = wrap.select('g');

              gEnter.append('g').attr('class', 'nv-legendWrap');
              gEnter.append('g').attr('class', 'nv-controlsWrap');
              gEnter.append('g').attr('class', 'nv-interactive');

              var focusEnter = gEnter.append('g').attr('class', 'nv-focus');
              gEnter.append('g').attr('class', 'nv-x nv-axis');
              gEnter.append('g').attr('class', 'nv-y nv-axis');
              gEnter.append('g').attr('class', 'nv-barsWrap');

              // context chart is where you can focus in
              var contextEnter = gEnter.append('g').attr('class', 'nv-context');
              contextEnter.append('g').attr('class', 'nv-x nv-axis');
              contextEnter.append('g').attr('class', 'nv-y nv-axis');
              contextEnter.append('g').attr('class', 'nv-barsWrap');
              contextEnter.append('g').attr('class', 'nv-brushBackground');
              contextEnter.append('g').attr('class', 'nv-x nv-brush');

              //============================================================
              // Legend
              //------------------------------------------------------------

              if (!showLegend) {
                  g.select('.nv-legendWrap').selectAll('*').remove();
              } else {
                  legend.width(availableWidth - controlWidth());

                  g.select('.nv-legendWrap')
                      .datum(data)
                      .call(legend);

                  if ( margin.top != legend.height()) {
                      margin.top = legend.height();
                      availableHeight = nv.utils.availableHeight(height, container, margin) - (focusEnable ? focus.height() : 0);
                  }

                  g.select('.nv-legendWrap')
                      .attr('transform', 'translate(' + controlWidth() + ',' + (-margin.top) +')');
              }

              wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

              //============================================================
              // Context chart (focus chart) components
              //------------------------------------------------------------

              // hide or show the focus context chart
              g.select('.nv-context').style('display', focusEnable ? 'initial' : 'none');

              bars2
                  .width(availableWidth)
                  .height(availableHeight2)
                  .color(data.map(function (d, i) {
                      return d.color || color(d, i);
                  }).filter(function (d, i) {
                      return !data[i].disabled && data[i].bar
                  }));

              var bars2Wrap = g.select('.nv-context .nv-barsWrap')

              g.select('.nv-context')
                  .attr('transform', 'translate(0,' + ( availableHeight + margin.bottom + margin2.top) + ')');

              bars2Wrap.transition().call(bars2);

              // context (focus chart) axis controls
              if (focusShowAxisX) {
                  x2Axis
                      ._ticks( nv.utils.calcTicksX(availableWidth / 100, data))
                      .tickSize(-availableHeight2, 0);
                  g.select('.nv-context .nv-x.nv-axis')
                      .attr('transform', 'translate(0,' + y2.range()[0] + ')');
                  g.select('.nv-context .nv-x.nv-axis').transition()
                      .call(x2Axis);
              }

              if (focusShowAxisY) {
                  y2Axis
                      .scale(y2)
                      ._ticks( availableHeight2 / 36 )
                      .tickSize( -availableWidth, 0);

                  g.select('.nv-context .nv-y2.nv-axis')
                      .style('opacity', dataBars.length ? 1 : 0)
                      .attr('transform', 'translate(0,' + x2.range()[0] + ')');

                  g.select('.nv-context .nv-y.nv-axis').transition()
                      .call(y3Axis);
              }

              // Setup Brush
              brush.x(x2).on('brush', onBrush);

              if (brushExtent) brush.extent(brushExtent);

              var brushBG = g.select('.nv-brushBackground').selectAll('g')
                  .data([brushExtent || brush.extent()]);

              var brushBGenter = brushBG.enter()
                  .append('g');

              brushBGenter.append('rect')
                  .attr('class', 'left')
                  .attr('x', 0)
                  .attr('y', 0)
                  .attr('height', availableHeight2);

              brushBGenter.append('rect')
                  .attr('class', 'right')
                  .attr('x', 0)
                  .attr('y', 0)
                  .attr('height', availableHeight2);

              var gBrush = g.select('.nv-x.nv-brush')
                  .call(brush);
              gBrush.selectAll('rect')
                  .attr('y', -5)
                  .attr('height', availableHeight2);
              gBrush.selectAll('.resize').append('path').attr('d', resizePath);

              // Controls (stacking and grouping)
              if (!showControls) {
                   g.select('.nv-controlsWrap').selectAll('*').remove();
              } else {
                  var controlsData = [
                      { key: controlLabels.grouped || 'Grouped', disabled: multibar.stacked() },
                      { key: controlLabels.stacked || 'Stacked', disabled: !multibar.stacked() }
                  ];

                  controls.width(controlWidth()).color(['#444', '#444', '#444']);
                  g.select('.nv-controlsWrap')
                      .datum(controlsData)
                      .attr('transform', 'translate(0,' + (-margin.top) +')')
                      .call(controls);
              }

              wrap.attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');
              if (rightAlignYAxis) {
                  g.select(".nv-y.nv-axis")
                      .attr("transform", "translate(" + availableWidth + ",0)");
              }

              // Main Chart Component(s)
              multibar
                  .disabled(data.map(function(series) { return series.disabled }))
                  .width(availableWidth)
                  .height(availableHeight)
                  .color(data.map(function(d,i) {
                      return d.color || color(d, i);
                  }).filter(function(d,i) { return !data[i].disabled }));


              var barsWrap = g.select('.nv-barsWrap')
                  .datum(data.filter(function(d) { return !d.disabled }));

              barsWrap.call(multibar);

              updateXAxis();
              updateYAxis();

              //Set up interactive layer
              if (useInteractiveGuideline) {
                  interactiveLayer
                      .width(availableWidth)
                      .height(availableHeight)
                      .margin({left:margin.left, top:margin.top})
                      .svgContainer(container)
                      .xScale(x);
                  wrap.select(".nv-interactive").call(interactiveLayer);
              }

              //============================================================
              // Event Handling/Dispatching (in chart's scope)
              //------------------------------------------------------------

              legend.dispatch.on('stateChange', function(newState) {
                  for (var key in newState)
                      state[key] = newState[key];
                  dispatch.stateChange(state);
                  chart.update();
              });

              controls.dispatch.on('legendClick', function(d,i) {
                  if (!d.disabled) return;
                  controlsData = controlsData.map(function(s) {
                      s.disabled = true;
                      return s;
                  });
                  d.disabled = false;

                  switch (d.key) {
                      case 'Grouped':
                      case controlLabels.grouped:
                          multibar.stacked(false);
                          break;
                      case 'Stacked':
                      case controlLabels.stacked:
                          multibar.stacked(true);
                          break;
                  }

                  state.stacked = multibar.stacked();
                  dispatch.stateChange(state);
                  chart.update();
              });

              // Update chart from a state object passed to event handler
              dispatch.on('changeState', function(e) {
                  if (typeof e.disabled !== 'undefined') {
                      data.forEach(function(series,i) {
                          series.disabled = e.disabled[i];
                      });
                      state.disabled = e.disabled;
                  }
                  if (typeof e.stacked !== 'undefined') {
                      multibar.stacked(e.stacked);
                      state.stacked = e.stacked;
                      stacked = e.stacked;
                  }
                  chart.update();
              });

              if (useInteractiveGuideline) {
                  interactiveLayer.dispatch.on('elementMousemove', function(e) {
                      if (e.pointXValue == undefined) return;

                      var singlePoint, pointIndex, pointXLocation, xValue, allData = [];
                      data
                          .filter(function(series, i) {
                              series.seriesIndex = i;
                              return !series.disabled;
                          })
                          .forEach(function(series,i) {
                              pointIndex = x.domain().indexOf(e.pointXValue)

                              var point = series.values[pointIndex];
                              if (point === undefined) return;

                              xValue = point.x;
                              if (singlePoint === undefined) singlePoint = point;
                              if (pointXLocation === undefined) pointXLocation = e.mouseX
                              allData.push({
                                  key: series.key,
                                  value: chart.y()(point, pointIndex),
                                  color: color(series,series.seriesIndex),
                                  data: series.values[pointIndex]
                              });
                          });

                      interactiveLayer.tooltip
                          .chartContainer(that.parentNode)
                          .data({
                              value: xValue,
                              index: pointIndex,
                              series: allData
                          })();

                      interactiveLayer.renderGuideLine(pointXLocation);
                  });

                  interactiveLayer.dispatch.on("elementMouseout",function(e) {
                      interactiveLayer.tooltip.hidden(true);
                  });
              }
              else {
                  multibar.dispatch.on('elementMouseover.tooltip', function(evt) {
                      evt.value = chart.x()(evt.data);
                      evt['series'] = {
                          key: evt.data.key,
                          value: chart.y()(evt.data),
                          color: evt.color
                      };
                      tooltip.data(evt).hidden(false);
                  });

                  multibar.dispatch.on('elementMouseout.tooltip', function(evt) {
                      tooltip.hidden(true);
                  });

                  multibar.dispatch.on('elementMousemove.tooltip', function(evt) {
                      tooltip();
                  });
              }

              //============================================================
              // Functions
              //------------------------------------------------------------

              // Taken from crossfilter (http://square.github.com/crossfilter/)
              function resizePath(d) {
                  var e = +(d == 'e'),
                      x = e ? 1 : -1,
                      y = availableHeight2 / 3;
                  return 'M' + (.5 * x) + ',' + y
                      + 'A6,6 0 0 ' + e + ' ' + (6.5 * x) + ',' + (y + 6)
                      + 'V' + (2 * y - 6)
                      + 'A6,6 0 0 ' + e + ' ' + (.5 * x) + ',' + (2 * y)
                      + 'Z'
                      + 'M' + (2.5 * x) + ',' + (y + 8)
                      + 'V' + (2 * y - 8)
                      + 'M' + (4.5 * x) + ',' + (y + 8)
                      + 'V' + (2 * y - 8);
              }

              function updateBrushBG() {
                  if (!brush.empty()) brush.extent(brushExtent);
                  brushBG
                      .data([brush.empty() ? x2.domain() : brushExtent])
                      .each(function(d,i) {
                          var leftWidth = x2(d[0]) - x2.range()[0],
                              rightWidth = x2.range()[1] - x2(d[1]);
                          d3.select(this).select('.left')
                              .attr('width',  leftWidth < 0 ? 0 : leftWidth);

                          d3.select(this).select('.right')
                              .attr('x', x2(d[1]))
                              .attr('width', rightWidth < 0 ? 0 : rightWidth);
                      });
              }

              function onBrush() {
                  // Update Main (Focus)
                  brushExtent = brush.empty() ? null : brush.extent();
                  extent = brush.empty() ? x2.domain() : brush.extent();
                  dispatch.brush({extent: extent, brush: brush});
                  updateBrushBG();

                  var focusBarsWrap = g.select('.nv-barsWrap');

                  focusBarsWrap.datum(
                    data.filter(function(d) { return !d.disabled; })
                        .map(function(d,i) {
                          return {
                            key: d.key,
                            nonStackable: d.nonStackable,
                            nonStackableSeries: d.nonStackableSeries,
                            values: d.values.filter(function(d,i) {
                                return multibar.x()(d,i) >= extent[0] && multibar.x()(d,i) <= extent[1];
                            }),
                          }
                    })
                  );
                  focusBarsWrap.transition().duration(duration).call(multibar);

                  updateXAxis();
                  updateYAxis();
              }

              //============================================================
              // Update Axes
              //============================================================
              function updateXAxis() {
                // Setup Axes
                if (showXAxis) {
                    xAxis
                        .scale(x)
                        ._ticks( nv.utils.calcTicksX(availableWidth/100, data) )
                        .tickSize(-availableHeight, 0);

                    g.select('.nv-x.nv-axis')
                        .attr('transform', 'translate(0,' + y.range()[0] + ')');
                    g.select('.nv-x.nv-axis')
                        .call(xAxis);

                    var xTicks = g.select('.nv-x.nv-axis > g').selectAll('g');

                    xTicks
                        .selectAll('line, text')
                        .style('opacity', 1)

                    if (staggerLabels) {
                        var getTranslate = function(x,y) {
                            return "translate(" + x + "," + y + ")";
                        };

                        var staggerUp = 5, staggerDown = 17;  //pixels to stagger by
                        // Issue #140
                        xTicks
                            .selectAll("text")
                            .attr('transform', function(d,i,j) {
                                return  getTranslate(0, (j % 2 == 0 ? staggerUp : staggerDown));
                            });

                        var totalInBetweenTicks = d3.selectAll(".nv-x.nv-axis .nv-wrap g g text")[0].length;
                        g.selectAll(".nv-x.nv-axis .nv-axisMaxMin text")
                            .attr("transform", function(d,i) {
                                return getTranslate(0, (i === 0 || totalInBetweenTicks % 2 !== 0) ? staggerDown : staggerUp);
                            });
                    }

                    if (wrapLabels) {
                        g.selectAll('.tick text')
                            .call(nv.utils.wrapTicks, chart.xAxis.rangeBand())
                    }

                    if (reduceXTicks)
                        xTicks
                            .filter(function(d,i) {
                                return i % Math.ceil(data[0].values.length / (availableWidth / 100)) !== 0;
                            })
                            .selectAll('text, line')
                            .style('opacity', 0);

                    if(rotateLabels)
                        xTicks
                            .selectAll('.tick text')
                            .attr('transform', 'rotate(' + rotateLabels + ' 0,0)')
                            .style('text-anchor', rotateLabels > 0 ? 'start' : 'end');

                    g.select('.nv-x.nv-axis').selectAll('g.nv-axisMaxMin text')
                        .style('opacity', 1);
                }
              }

              function updateYAxis() {
                if (showYAxis) {
                    yAxis
                        .scale(y)
                        ._ticks( nv.utils.calcTicksY(availableHeight/36, data) )
                        .tickSize( -availableWidth, 0);

                    g.select('.nv-y.nv-axis')
                        .call(yAxis);
                }
                g.select('.nv-focus .nv-x.nv-axis')
                    .attr('transform', 'translate(0,' + availableHeight + ')');
              }

              onBrush();

          });

          renderWatch.renderEnd('multibarchart immediate');
          return chart;
      }

      //============================================================
      // Expose Public Variables
      //------------------------------------------------------------

      // expose chart's sub-components
      chart.dispatch = dispatch;
      chart.multibar = multibar;
      chart.legend = legend;
      chart.controls = controls;
      chart.xAxis = xAxis;
      chart.yAxis = yAxis;
      chart.x2Axis = x2Axis;
      chart.y2Axis = y2Axis;
      chart.state = state;
      chart.tooltip = tooltip;
      chart.interactiveLayer = interactiveLayer;

      chart.options = nv.utils.optionsFunc.bind(chart);

      chart._options = Object.create({}, {
          // simple options, just get/set the necessary values
          width:      {get: function(){return width;}, set: function(_){width=_;}},
          height:     {get: function(){return height;}, set: function(_){height=_;}},
          showLegend: {get: function(){return showLegend;}, set: function(_){showLegend=_;}},
          brushExtent:    {get: function(){return brushExtent;}, set: function(_){brushExtent=_;}},
          showControls: {get: function(){return showControls;}, set: function(_){showControls=_;}},
          controlLabels: {get: function(){return controlLabels;}, set: function(_){controlLabels=_;}},
          showXAxis:      {get: function(){return showXAxis;}, set: function(_){showXAxis=_;}},
          showYAxis:    {get: function(){return showYAxis;}, set: function(_){showYAxis=_;}},
          defaultState:    {get: function(){return defaultState;}, set: function(_){defaultState=_;}},
          noData:    {get: function(){return noData;}, set: function(_){noData=_;}},
          reduceXTicks:    {get: function(){return reduceXTicks;}, set: function(_){reduceXTicks=_;}},
          rotateLabels:    {get: function(){return rotateLabels;}, set: function(_){rotateLabels=_;}},
          staggerLabels:    {get: function(){return staggerLabels;}, set: function(_){staggerLabels=_;}},
          wrapLabels:   {get: function(){return wrapLabels;}, set: function(_){wrapLabels=!!_;}},

          // options that require extra logic in the setter
          margin: {get: function(){return margin;}, set: function(_){
              margin.top    = _.top    !== undefined ? _.top    : margin.top;
              margin.right  = _.right  !== undefined ? _.right  : margin.right;
              margin.bottom = _.bottom !== undefined ? _.bottom : margin.bottom;
              margin.left   = _.left   !== undefined ? _.left   : margin.left;
          }},
          duration: {get: function(){return duration;}, set: function(_){
              duration = _;
              multibar.duration(duration);
              xAxis.duration(duration);
              yAxis.duration(duration);
              renderWatch.reset(duration);
          }},
          color:  {get: function(){return color;}, set: function(_){
              color = nv.utils.getColor(_);
              legend.color(color);
          }},
          rightAlignYAxis: {get: function(){return rightAlignYAxis;}, set: function(_){
              rightAlignYAxis = _;
              yAxis.orient( rightAlignYAxis ? 'right' : 'left');
          }},
          useInteractiveGuideline: {get: function(){return useInteractiveGuideline;}, set: function(_){
              useInteractiveGuideline = _;
          }},
          barColor:  {get: function(){return multibar.barColor;}, set: function(_){
              multibar.barColor(_);
              legend.color(function(d,i) {return d3.rgb('#ccc').darker(i * 1.5).toString();})
          }}
      });

      nv.utils.inheritOptions(chart, multibar);
      nv.utils.initOptions(chart);

      return chart;
  };
})();
