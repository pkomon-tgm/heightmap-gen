


function main() {

    const whiteNoise = Math.random;

    const numSamples = 1000;
    const samples = [...Array(numSamples).keys()]
            .map(whiteNoise);

    const fft = math.fft(samples);

    // visualization for 1D
    const svgWidth = parseFloat(d3.select("#container").style("width"));
    const svgHeight = 500;

    d3.select("#hurstExponentSlider")
        .style("width", svgWidth + "px")
        .attr("value", 0);

    d3.select("#container")
        .append("svg")
        .attr("width", svgWidth)
        .attr("height", svgHeight)
        .style("border", "solid black 1px");

    const xScale = d3.scaleLinear()
        .domain([0, 1])
        .range([0, svgWidth]);

    const yScale = d3.scaleLinear()
        .domain([0, 1])
        .range([0, svgHeight]);

    let path = d3.select("#container>svg")
        .append("path");

    function calculateResult(hurstExponent, fft) {
        const modifiedFft = fft.map((c, i) => math.multiply(c, 1 / Math.pow((i+1) / fft.length, hurstExponent)));

        const result = math.ifft(modifiedFft)
            .map(y => y.re);
        const minResult = math.min(...result);
        const maxResult = math.max(...result);

        const normalizedResult = result.map(re => (re - minResult) / (maxResult - minResult));
        return normalizedResult;
    }


    function updateLineChart(data) {
        path
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "black")
            .attr("stroke-width", 1)
            .attr("d", d3.line()
                .x((d, i) => xScale(i / data.length))
                .y(d => yScale(d)));
    }

    function calcResultAndUpdateLineChart(hurstExponent) {
        const normalizedResult = calculateResult(hurstExponent, fft);
        console.log(normalizedResult);
        updateLineChart(normalizedResult);
        d3.select("#hurstExponentDisplay")
            .text(hurstExponent);
    }

    d3.select("#hurstExponentSlider")
        .on("input", event => calcResultAndUpdateLineChart(event.target.value));

    calcResultAndUpdateLineChart(d3.select("#hurstExponentSlider").attr("value"));

}