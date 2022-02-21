Array.prototype.sample = function () {
    return this[Math.floor(Math.random() * this.length)];
}

function computeCirclingPolygon(radius) {
    //this function draws the clipping polygon in which the voronoi is drawn

    const edgeCount = 100 //4>square | 100>circle

    let rotation = 0
    if (edgeCount === 3) { rotation = 30 * 2 * Math.PI / 360 }
    if (edgeCount === 4) { rotation = 45 * 2 * Math.PI / 360 }
    if (edgeCount === 5) { rotation = 54 * 2 * Math.PI / 360 }

    const shape = d3.range(edgeCount).map(i => {
        const rad = rotation + i / edgeCount * 2 * Math.PI;
        return [radius + radius * Math.cos(rad), radius + radius * Math.sin(rad)]
    })

    return shape;
};

function maxTreeValue(node) {
    return node.ancestors().filter(d => { return d.depth === 0 })[0].value
}

function flattenHierarchy(node) {
    return node.descendants().sort(function (a, b) { return b.depth - a.depth })
}

function closestPoint(pathNode, point) {
    var pathLength = pathNode.getTotalLength(),
        precision = 8,
        best,
        bestLength,
        bestDistance = Infinity;

    // linear scan for coarse approximation
    for (let scan = 0, scanLength = 0, scanDistance; scanLength <= pathLength; scanLength += precision) {
        if ((scanDistance = distance2(scan = pathNode.getPointAtLength(scanLength))) < bestDistance) {
            best = scan, bestLength = scanLength, bestDistance = scanDistance;
        }
    }
    // binary search for precise estimate
    precision /= 2;
    while (precision > 0.5) {
        var before,
            after,
            beforeLength,
            afterLength,
            beforeDistance,
            afterDistance;
        if ((beforeLength = bestLength - precision) >= 0 && (beforeDistance = distance2(before = pathNode.getPointAtLength(beforeLength))) < bestDistance) {
            best = before, bestLength = beforeLength, bestDistance = beforeDistance;
        } else if ((afterLength = bestLength + precision) <= pathLength && (afterDistance = distance2(after = pathNode.getPointAtLength(afterLength))) < bestDistance) {
            best = after, bestLength = afterLength, bestDistance = afterDistance;
        } else {
            precision /= 2;
        }
    }

    best = [best.x, best.y];
    best.distance = Math.sqrt(bestDistance);
    return best;

    function distance2(p) {
        var dx = p.x - point[0],
            dy = p.y - point[1];
        return dx * dx + dy * dy;
    }
}

function leaveValues(hierarchy) {

    const leaveValues = []

    hierarchy.descendants().forEach(d => { return d.depth != 0 ? leaveValues.push(d.value) : null })

    const leaveMin = d3.min(leaveValues)
    const leaveMax = d3.max(leaveValues)
    const leaveMiddle = (leaveMin + leaveMax) / 2

    return [leaveMin, leaveMax, leaveMiddle]
}

function lineGenerator(parentElement, background, fill, size) {
    const texture = textures
        .lines()
        .thicker()
        .stroke(fill)
        .background(background)
        .orientation(`${[1, 2, 3, 4, 5, 6, 7, 8].sample()}/8`)
    // .size(size);

    parentElement.call(texture);
    return texture.url()
}

function waveGenerator(parentElement, background, fill, size) {
    const texture = textures
        .paths()
        .d('waves')
        // .thicker()
        .stroke(fill)
        .background(background)
        .size(size);

    parentElement.call(texture);
    return texture.url()
}

function groupAnnotationCreator(children) {
    let annotations = []
    children.forEach(d => {

        let labelX = d3.polygonCentroid(d.polygon)[0]
        let labelY = d3.polygonCentroid(d.polygon)[1]

        const annotationLength = 3
        annotations.push({
            note: {
                label: `${d3.format('.' + 3 + 'f')(d.value)} ${d.data.Unit}`,//<br>(${d3.format('.'+0+'f')((d.value / maxTreeValue(children)) * 100, 2)}%)`,
                title: `${d.data.Process_shorthand}`.split(' ').slice(0, annotationLength).join(' ') + (`${d.data.Process_shorthand}`.split(' ').length > annotationLength ? ' ...' : '')
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

function retrieveVisible(element) {
    return d3.selectAll(element).filter(function (d, i) { return d3.select(this).style('fill-opacity') == 1 })
}

function drag() {

    function dragged(event, d) {
        let ux = this.x.animVal.value || 0
        let uy = this.y.animVal.value || 0

        let lux = Number(d3.select(this.parentNode).select('line').attr('x2')) || 0
        let luy = Number(d3.select(this.parentNode).select('line').attr('y2')) || 0

        ux += event.dx
        uy += event.dy

        lux += event.dx
        luy += event.dy

        d3.select(this)
            .attr('x', ux)
            .attr('y', uy)

        d3.select(this.parentNode).select('line')
            .attr('x2', lux)
            .attr('y2', luy)
    }

    return d3.drag()
        .on("drag", dragged)
}