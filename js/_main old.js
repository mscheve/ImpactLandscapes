const svgWidth = 700,
  svgHeight = 700,
  margin = {top: 100, right: 100, bottom: 50, left: 100},
  halfWidth = svgWidth / 2,
  halfHeight = svgHeight / 2,
  landscapeScale = 1
  treemapRadius = Math.min(((svgWidth/2) - margin.left - margin.right),((svgHeight/2) - margin.top - margin.bottom))*landscapeScale,
  treemapCenter = [halfWidth + margin.left - margin.right, halfHeight + margin.top - margin.bottom],
  menuHeight = margin.top,
  annotationHeight = 100,
  annotationWidth = 150,
  minColor = '#4e8200',
  midColor = '#ffe600',
  maxColor = '#4f3515',
  outerColor = '#1d260f',
  minBorderWidth = 1,
  maxBorderWidth = 8,
  noLevelsDisplayed = 2,
  minLabelSize = 10,
  maxLabelSize = 15, 
  stroke_delta = (maxBorderWidth - minBorderWidth) * 1.0 / noLevelsDisplayed;

let initialRun = true
let currentDepth = 1

const _voronoiTreemap = d3.voronoiTreemap()
  .convergenceRatio([0.1])
  .maxIterationCount([100]);
let currentHierarchy, circlingPolygon;

let svg, drawingArea, treemapContainer, flattenedHierarchy, tooltip;

const fontScale = d3.scaleLinear().range([minLabelSize, maxLabelSize]).clamp(true);

const color = d3.scaleLinear()
  .range([minColor, midColor, maxColor])

const menuBands = d3.scaleBand()
  .range([0, treemapRadius * 2])
  .paddingInner(0.2)

d3.csv("data/Climate_Change_FrenchFriesFrozenRawIntendedToBeDeepFried_full.csv").then(function (data) {
  data.forEach(d => {
    d.Amount = Number(d.Amount)
    d.value = d.Amount
  })

  hierarchy = d3.stratify()
    .id(d => d.id)
    .parentId(d => d.parent_id)(data)
    .each(d => d.value = d.data.value)

  currentHierarchy = hierarchy

  const lValues = leaveValues(hierarchy)
  color.domain([lValues[0], lValues[2], lValues[1]])
  menuBands.domain([...Array(hierarchy.depth + 1 + hierarchy.height).keys()])

  circlingPolygon = computeCirclingPolygon(treemapRadius);
  initLayout();
  drawTreemap(hierarchy, currentDepth);

});

function initLayout() {

  svg = d3.select("svg")
    .attr("width", svgWidth)
    .attr("height", svgHeight)

  treemapContainer = svg.append("g")
    .classed("treemap-container", true)
    .attr("transform", "translate(" + treemapCenter + ")");

  dummyPaths = treemapContainer.append('g')
    .classed('dummy-container', true)

  const containerList = [
    'polygon-container',
    'cell-container',
    'label-container',
    'annotation-container',
    'menu-container',
    'hover-container',
  ]

  containerList.forEach(d => {
    treemapContainer.append('g')
      .classed(d, true)
      .attr("transform", "translate(" + [-treemapRadius, -treemapRadius] + ")")
  })
  
  tooltip = d3.componentsTooltip()
    .container(treemapContainer.select('.hover-container'))

  treemapContainer.select('.menu-container')
    .attr('transform', `translate(${[-treemapRadius, -treemapCenter[1] + margin.top]})`)

  textureContainer = treemapContainer.select('.cell-container')
    .append('g')
    .classed('texture-container', true)

  treemapContainer.select('.polygon-container')
    .append("path")
    .attr("d", "M" + circlingPolygon.join(",") + "Z")
    .style('stroke-width', maxBorderWidth)
    .style('stroke', outerColor);

}

function drawTreemap(hierarchy, levelI) {
  
  if (currentDepth <= hierarchy.depth) {
    currentDepth = hierarchy.children ? hierarchy.depth + 1 : hierarchy.depth
    levelI = currentDepth
  }

  d3.select('body').on('keydown', (event, _d) => {
    switch (event.key) {
      case 'ArrowDown':
        currentDepth -= currentDepth > 1 ? 1 : 0
        break
      case 'ArrowUp':
        currentDepth += currentDepth < hierarchy.depth + hierarchy.height ? 1 : 0
    }
    drawTreemap(currentHierarchy, currentDepth)
  })

  fontScale.domain([leaveValues(hierarchy)[0], leaveValues(hierarchy)[1]])

  const t = d3.transition().duration(initialRun ? 0 : 750)

  if ((hierarchy.id != currentHierarchy.id) || initialRun) {
    _voronoiTreemap.clip(circlingPolygon)(hierarchy);
  }

  const flattenedHierarchy = flattenHierarchy(hierarchy)

  //drawing voronoi cells
  const cellContainer = treemapContainer.select('.cell-container')
  const cells = cellContainer.selectAll(".cell")
    .data(flattenedHierarchy, d => d.id)

  cells.exit().remove()

  cells.enter().append("path")
    .classed("cell", true)
    .attr('id', d => `cell-${d.id}`)
    .style("fill", d => d.depth === 0 ? outerColor : lineGenerator(textureContainer, color(d.value), d3.color(color(d.value)).darker(0.4)))//function(d,i){return color(d.value)})
    .style('stroke', _d => d3.color(outerColor))
    .merge(cells)
    .transition(t)
    .style("fill-opacity", function (d) { return (d.depth === levelI) || (!(d.children) && (d.depth <= levelI)) ? 1 : 0; })
    .attr("d", function (d) { return "M" + d.polygon.join(",") + "z"; })
    .style('stroke-width', function (d) {
      const substract = d.depth === hierarchy.depth + 1 ? 1 : 0
      return Math.max(maxBorderWidth - stroke_delta * (d.depth - hierarchy.depth - substract), minBorderWidth) + "px";
    });

  //drawing labels in voronoi cells
  const labelContainer = treemapContainer.select('.label-container')
  const labels = labelContainer.selectAll(".label")
    .data(flattenedHierarchy, d => d.id)

  labels.exit().remove()

  labels.enter().append("text")
    .classed("label", true)
    .attr('id', d => `label-${d.id}`)
    .style('fill', d => d3.color(color(d.value)).darker(3))
    .merge(labels)
    .transition(t)
    .attr("font-size", function (d) { return d.value / leaveValues(hierarchy)[1] > 0.05 ? fontScale(d.value) ** 2 / 10 : 0; })
    .attr("fill-opacity", function (d) { return (d.depth === levelI) || (!(d.children) && (d.depth <= levelI)) ? 1 : 0; })
    .text(function (d) { return d3.format('.' + 0 + 'f')((d.value / maxTreeValue(hierarchy)) * 100, 2) + "%"; })
    .attr("transform", function (d) { return d.depth === 0 ? null : "translate(" + d3.polygonCentroid(d.polygon) + ")"; })

  //drawing annotations around voronoi treemap
  const annotationContainer = treemapContainer.select('.annotation-container')
  drawAnnotations(annotationContainer, hierarchy)

  //drawing hover info and paths
  const hoverContainer = treemapContainer.select('.hover-container')
  const hoverers = hoverContainer.selectAll(".hoverer")
    .data(flattenedHierarchy.filter(d => { return (d.depth === levelI) || (!(d.children) && (d.depth <= levelI)) }), d => d.id)

  hoverers.exit().remove()

  hoverers.enter().append("path")
    .classed("hoverer", true)
    .attr('id', d => `hover-${d.id}`)
    .merge(hoverers)
    .attr("d", function (d) { return "M" + d.polygon.join(",") + "z"; })
    .style('cursor', 'pointer')
    .on('contextmenu', (event, d) => {
      event.preventDefault()
      drawAnnotations(annotationContainer, hierarchy, d)
    })
    .on('click', (_event, d) => {
      drawTreemap(d, currentDepth)
      currentHierarchy = d
    })
    .on('mouseout', (_event, _d) => tooltip.hide())
    .on('mouseover', (_event, d) => {
      tooltip
        .x(d3.polygonCentroid(d.polygon)[0])
        .y(d3.polygonCentroid(d.polygon)[1])
        .show(d)
    })

  //drawing menu above voronoi treemap

  const menu = treemapContainer.select('.menu-container')
  menu.append('g').classed('menu-roadmap', true)
  const menuRoadMap = menu.select('.menu-roadmap', true)

  const menuLines = menuRoadMap.selectAll('.menu-line')
    .data(_.range(hierarchy.depth, hierarchy.depth + hierarchy.height + 1), d => d)

  menuLines.exit()
    .attr('stroke', d => d < hierarchy.depth ? minColor : d > hierarchy.height + 1 ? 'white' : minColor)

  menuLines.enter().append('line')
    .classed('menu-line', true)
    .merge(menuLines)
    .transition(t)
    .attr('x1', d => menuBands(d))
    .attr('y1', - menuBands.bandwidth() / 2)
    .attr('x2', (d, _i, _list) => d === 0 ? menuBands(d) : menuBands(d - 1) + menuBands.bandwidth())
    .attr('y2', - menuBands.bandwidth() / 2)
    .attr('stroke', d => d === hierarchy.depth ? minColor : 'lightgrey')
    .attr('stroke-width', menuBands.bandwidth() / 10)

  const menuItems = menuRoadMap.selectAll('.menu-circle')
    .data(_.range(hierarchy.depth, hierarchy.depth + hierarchy.height + 1), d => d)

  menuItems.exit()
    .transition(t)
    .attr('fill', d => d < hierarchy.depth ? 'white' : d > hierarchy.height + 1 ? 'white' : 'white')
    .attr('stroke', d => d < hierarchy.depth ? minColor : d > hierarchy.height + 1 ? 'white' : minColor)

  menuItems.enter().append('circle')
    .classed('menu-circle', true)
    .merge(menuItems)
    .transition(t)
    .attr('cx', d => menuBands(d) + menuBands.bandwidth() / 2)
    .attr('cy', - menuBands.bandwidth() / 2)
    .attr('r', menuBands.bandwidth() / 2)
    .attr('fill', d => d === hierarchy.depth ? minColor : 'white')
    .attr('stroke', d => d === currentDepth ? 'black' : d === hierarchy.depth ? minColor : 'lightgrey')
    .attr('stroke-width', d => d === currentDepth ? 2 : 1)

  const manuXAxis = d3.axisBottom(menuBands);
  menuRoadMap.select('.manuXAxis').remove()
  menuRoadMap.append('g')
    .attr('class', 'manuXAxis')
    .attr('transform', `translate(0, ${-menuBands.bandwidth()})`)
    .call(manuXAxis)
  menuRoadMap.selectAll('.manuXAxis .tick text')
    .attr('dy', (_d, i, element) => (menuBands.bandwidth() / 2) - (element[i].clientHeight / 2))
    .attr('color', d => (d === hierarchy.depth) ? 'white' : 'black')
    .text(d => d === 0 ? '\u29BF' : d)

  const menuButtons = menuRoadMap.selectAll('.menu-button')
    .data([...Array(hierarchy.depth).keys()], d => d).raise()

  menuButtons.exit().remove()

  menuButtons.enter().append('circle')
    .classed('menu-button', true)
    .raise()
    .attr('cx', d => menuBands(d) + menuBands.bandwidth() / 2)
    .attr('cy', - menuBands.bandwidth() / 2)
    .attr('r', menuBands.bandwidth() / 2)
    .attr('fill', 'transparent')
    .style('cursor', 'pointer')
    .on('click', (_event, d) => {
      drawTreemap(hierarchy.ancestors().reverse()[d], currentDepth)
      currentHierarchy = hierarchy.ancestors().reverse()[d]
    })

  let menuTitleContent = menu.selectAll('.menu-title-container')
    .data([hierarchy.depth], d => d)

  menuTitleContent.exit().remove()

  menuTitleContent = menuTitleContent.enter().append('g')
    .attr('class', 'menu-title-container')
    .append('foreignObject')
    .attr('width', menuBands.range()[1])
    .attr('height', menuHeight)
    .attr('transform', `translate(0, ${-menuBands.bandwidth() - menuHeight - 10})`)
    .append('xhtml:div')
    .append('div')
    .classed('menu-title-parent', true)
    .append('div')
    .classed('menu-title', true)
    .html(hierarchy.data.Process)
    .merge(menuTitleContent)

  //after first draw, set inital run to false to activate transition animations
  initialRun = false
}
