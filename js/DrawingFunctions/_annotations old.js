function groupAnnotationCreator(children) {
  let annotations = []
  children.forEach(d => {

    let labelX = d3.polygonCentroid(d.polygon)[0]
    let labelY = d3.polygonCentroid(d.polygon)[1]

    const annotationLength = 4
    annotations.push({
      note: {
        label: `${d3.format('.' + 2 + 'f')(d.value)} ${d.data.Unit}`,//<br>(${d3.format('.'+0+'f')((d.value / maxTreeValue(children)) * 100, 2)}%)`,
        title: `${d.data.Process}`.split(' ').slice(0, annotationLength).join(' ') + (`${d.data.Process}`.split(' ').length > annotationLength ? ' ...' : '')
      },
      x: labelX,
      y: labelY,
      ox: labelX,
      oy: labelY,
      id: d.id,
      polygon: d.polygon
    })
  })
  return annotations
}

let markedCells
function drawAnnotations(annotationContainer, hierarchy, marking) {
  let reset = true
  initialRun ? reset = true : (currentHierarchy != hierarchy) ? reset = true : reset = false

  if (reset) {
    markedCells = hierarchy.descendants().filter(d => {
      // return (d.depth === currentDepth) || (!(d.children) && (d.depth <= currentDepth))
      return (d.depth === 1)
    }).sort((a, b) => { return b.value - a.value }).slice(0, 5)
  }

  if (marking) {
    markedCells.map(d => d.id).includes(marking.id) ? markedCells = markedCells.filter(d => { return !(d.id === marking.id) }) : markedCells.push(marking)
  }

  let groupAnnotations = groupAnnotationCreator(markedCells)

  const annotation = annotationContainer.selectAll('g')
    .data(groupAnnotations, d => d.id)

  annotation.exit().remove()

  const annotation2 = annotation.enter().append('g').merge(annotation)

  annotation2.selectAll('*').remove()

  const annotation3 = annotation2.append('line')
    .attr('class', 'anno-connector-border')
    .attr('stroke', outerColor)
    .attr('stroke-width', 1)

  const annotationDiv = annotation2
    .append('foreignObject')
    .attr('width', annotationWidth)
    .attr('height', annotationHeight)
    .append('xhtml:div')
    .classed('annotation-container', true)
    .append('div')
    .classed('annotation-dummy-div', true)
    .append('div')
    .classed('annotation-div', true)
    .style('border-color', outerColor)
    .on('contextmenu', (event, d) => {
      event.preventDefault()
      drawAnnotations(annotationContainer, hierarchy, d)
    })

  annotationDiv.append('div')
    .classed('annotation title', true)
    .html(d => `${d.note.title}`)
  annotationDiv
    .append('div')
    .classed('annotation content', true)
    .html(d => `${d.note.label}`)

  const divDimensions = {}
  annotationDiv._groups[0].forEach(d => divDimensions[d.__data__.id] = { height: d.getBoundingClientRect().height, width: d.getBoundingClientRect().width })

  const mapCentroid = d3.polygonCentroid(circlingPolygon)
  const simulation = d3.forceSimulation(groupAnnotations)
    .force("charge", d3.forceCollide().radius(75))
    .force("r", d3.forceRadial(treemapRadius + 45, mapCentroid[0], mapCentroid[1]))
    .force('x', d => d3.forceCenter(d.x, d.y))
    .alphaMin(0.001)
    .tick(10000) //to make simulation appear static
    .on("end", ticked);

  function ticked() {

    annotation3.each(d => {
      // marking ? console.log(d.id === marking.id) : null
      d.ox = closestPoint(dummyPaths.append('path').datum(d.polygon).lower().attr('fill', 'transparent').attr('d', d3.line().curve(d3.curveLinear)).node(), [d.x, d.y])[0]
      d.oy = closestPoint(dummyPaths.append('path').datum(d.polygon).lower().attr('fill', 'transparent').attr('d', d3.line().curve(d3.curveLinear)).node(), [d.x, d.y])[1]
      d.y = Math.max(mapCentroid[1] -treemapCenter[1] + margin.top + annotationHeight / 2, Math.min(mapCentroid[1] +treemapCenter[1] - margin.top, d.y))
    })
    annotationDiv.each(d => {
      d.annotationAngle = geometric.lineAngle([[d.ox, d.oy], [d.x, d.y]])
    })

    annotation3.each(d => {
      if ((d.annotationAngle <= 0 & d.annotationAngle > -45) || (d.annotationAngle <= 45 & d.annotationAngle > 0)) {
        d.dx = -(divDimensions[d.id].width / 2)
        d.dy = 0
      }
      if (d.annotationAngle <= -45 & d.annotationAngle > -135) {
        d.dy = (divDimensions[d.id].height / 2)
        d.dx = 0
      }
      if ((d.annotationAngle <= -135 & d.annotationAngle >= -180) || (d.annotationAngle <= 180 & d.annotationAngle > 135)) {
        d.dx = (divDimensions[d.id].width / 2)
        d.dy = 0
      }
      if (d.annotationAngle <= 135 & d.annotationAngle > 45) {
        d.dy = -(divDimensions[d.id].height / 2)
        d.dx = 0
      }
    })

    annotation2
      .attr('transform', d => `translate(${(d.x - (annotationWidth / 2)) - d.dx}, ${Math.max(mapCentroid[1] -treemapCenter[1] + margin.top, Math.min(mapCentroid[1] +treemapCenter[1] - margin.top, (d.y - (annotationHeight / 2)) - d.dy))})`)

    annotation3
      .attr('x1', d => d.ox)
      .attr('x2', d => d.x)
      .attr('y1', d => d.oy)
      .attr('y2', d => d.y)
      .attr('transform', d => `translate(${- (d.x - annotationWidth / 2) + d.dx}, ${- (Math.max(mapCentroid[1] -treemapCenter[1] + margin.top, Math.min(mapCentroid[1] +treemapCenter[1] - margin.top, (d.y - (annotationHeight / 2)) - d.dy)))})`)

    annotationDiv
      .style('border-left-style', d => (d.annotationAngle <= 0 & d.annotationAngle > -45) || (d.annotationAngle <= 45 & d.annotationAngle > 0) ? 'solid' : 'hidden')
      .style('border-bottom-style', d => d.annotationAngle <= -45 & d.annotationAngle > -135 ? 'solid' : 'hidden')
      .style('border-right-style', d => (d.annotationAngle <= -135 & d.annotationAngle >= -180) || (d.annotationAngle <= 180 & d.annotationAngle > 135) ? 'solid' : 'hidden')
      .style('border-top-style', d => d.annotationAngle <= 135 & d.annotationAngle > 45 ? 'solid' : 'hidden')
      .style('text-align', d => {
        if ((d.annotationAngle <= 0 & d.annotationAngle > -45) || (d.annotationAngle <= 45 & d.annotationAngle > 0)) {
          return 'left'
        }
        if (d.annotationAngle <= -45 & d.annotationAngle > -135) {
          return 'center'
        }
        if ((d.annotationAngle <= -135 & d.annotationAngle >= -180) || (d.annotationAngle <= 180 & d.annotationAngle > 135)) {
          return 'right'
        }
        if (d.annotationAngle <= 135 & d.annotationAngle > 45) {
          return 'center'
        }
      })
  }
}