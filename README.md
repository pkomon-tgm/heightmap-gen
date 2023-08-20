# heightmap-gen
JavaScript heightmap generator using spectral synthesis, [three.js](https://threejs.org/) and [math.js](https://mathjs.org/)

The demo is available [here](https://pkomon-tgm.github.io/heightmap-gen/).

## How does it work?
On a regular grid, a sample is generated for every grid point.
These samples represent the height of each vertex on the grid.
The samples are generated based on [fractal Brownian motion (fBm)](https://en.wikipedia.org/wiki/Fractional_Brownian_motion). 

We approximate fBm by
1. calculating (uniformly distributed) random values for every grid point
2. calculating the discrete two-dimensional Fourier transform of these random values
3. scaling the Fourier coefficients with $\frac{1}{(af_x + bf_y)^H}$
   * $f_x$, $f_y$ frequencies in $x$, $y) direction, respectively
   * $H$ hurst exponent ("roughness")
   * $a$, $b$ factors for scaling frequencies
4. calculating the Inverse two-dimensional Fourier transform from the scaled coefficient

## How to run?
Run a local web server and use the repository's root directory as root.
