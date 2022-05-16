// this function computes the clipping polygon (i.e. the boundary shape of the treemap)
// adapted from https://bl.ocks.org/Kcnarf/fa95aa7b076f537c00aed614c29bb568
function computeCirclingPolygon(radius) {

    const edgeCount = 100 //3:triangle, 4:square, 5:pentagon, 100:circle

    let rotation = 0
    if (edgeCount === 3) {
        rotation = 30 * 2 * Math.PI / 360
    }
    if (edgeCount === 4) {
        rotation = 45 * 2 * Math.PI / 360
    }
    if (edgeCount === 5) {
        rotation = 54 * 2 * Math.PI / 360
    }

    const shape = d3.range(edgeCount).map(i => {
        const rad = rotation + i / edgeCount * 2 * Math.PI;
        return [radius + radius * Math.cos(rad), radius + radius * Math.sin(rad)]
    })

    return shape;
};


// this function determines the point of an input polygon closest to another arbitrary point
// adapted from https://bl.ocks.org/mbostock/8027637
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
        if ((beforeLength = bestLength - precision) >= 0 &&
            (beforeDistance = distance2(before = pathNode.getPointAtLength(beforeLength))) < bestDistance) {
            best = before, bestLength = beforeLength, bestDistance = beforeDistance;
        } else if (
            (afterLength = bestLength + precision) <= pathLength &&
            (afterDistance = distance2(after = pathNode.getPointAtLength(afterLength))) < bestDistance) {
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


// this function finds the numerical value of an array that is closest to another arbitrary numerical value
// adapted from https://jsbin.com/woqoju/2/edit?js,console,output
const findClosest = (arr, num) => {
    if (arr == null) {
        return
    }

    let closest = arr[0];
    for (let item of arr) {
        if (Math.abs(item - num) < Math.abs(closest - num)) {
            closest = item;
        }
    }
    return closest;
}


// this function scans of two html DOM objects colide with each other (overlap)
// adapted from https://gist.github.com/yckart/7177551
function colide(el1, el2) {
    var rect1 = el1.getBoundingClientRect();
    var rect2 = el2.getBoundingClientRect();

    return !(
        rect1.top > rect2.bottom ||
        rect1.right < rect2.left ||
        rect1.bottom < rect2.top ||
        rect1.left > rect2.right
    )
}


// this function determines the maximum impact value in a contribution tree from the perspective of an input node
function maxTreeValue(node) {
    return node.ancestors().filter(d => { return d.depth === 0 })[0].value
}


// this function determines the impact values of the leaves in a contribution tree from the perspective of an input node
function leaveValues(node) {

    const leaveValues = []

    node.descendants().forEach(d => {
        if (d.depth != 0) { return leaveValues.push(d.value) }
        else { return null }
    })

    const leaveMin = d3.min(leaveValues)
    const leaveMax = d3.max(leaveValues)
    const leaveMiddle = (leaveMin + leaveMax) / 2

    return [leaveMin, leaveMax, leaveMiddle]
}


// this function converts the hierarchical tree structure to a flattened array from the perspective of an input node
function flattenHierarchy(node) {
    return node.descendants().sort(function (a, b) { return b.depth - a.depth })
}


// implementing a sample method for the standard javascript array
Array.prototype.sample = function () {
    return this[Math.floor(Math.random() * this.length)];
}


// this function generates a random line pattern fill to resemble agricultural fields from an aerial perspective
function lineGenerator(parentElement, background, fill, size) {
    const texture = textures
        .lines()
        .thicker()
        .stroke(fill)
        .background(background)
        .orientation(`${[1, 2, 3, 5, 6, 7].sample()}/8`)

    if (size) {
        texture.size(size);
    }

    parentElement.call(texture);
    return texture.url()
}


// this function is used to make the annotations manually dragable
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


// this function synchronizes some global variables to facilitate multi product system (i.e. impact landscape) comparison
function landscapeValueSync(vis, hierarchy) {
    if (landscapeGlobalValues) {
        let index
        landscapes.forEach((landscape, i) => {
            if (landscape === vis) {
                index = i
            }
        })
        landscapeGlobalValues[index] = hierarchy.value
    }
}