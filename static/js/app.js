const state = {
  metadata: null,
  tracks: [],
  genres: [],
  years: [],
  colorBy: "year",
  hasSample: false
};

const featureLabels = new Map([
  ["danceability", "Danceability"],
  ["energy", "Energy"],
  ["valence", "Valence"],
  ["acousticness", "Acousticness"],
  ["instrumentalness", "Instrumentalness"],
  ["liveness", "Liveness"],
  ["speechiness", "Speechiness"],
  ["tempo", "Tempo"],
  ["loudness", "Loudness"],
  ["popularity", "Popularity"],
  ["year", "Year"]
]);

const tooltip = d3.select("#tooltip");

function showTooltip(event, html) {
  tooltip
    .style("opacity", 1)
    .style("left", `${event.clientX}px`)
    .style("top", `${event.clientY}px`)
    .html(html);
}

function hideTooltip() {
  tooltip.style("opacity", 0);
}

function trackTooltip(d) {
  return `
    <strong>${d.name}</strong><br>
    ${d.artist}<br>
    ${d.primary_genre}<br>
    Year: ${Math.round(d.year)}<br>
    Popularity: ${d.popularity}<br>
    Energy: ${d.energy.toFixed(2)} | Danceability: ${d.danceability.toFixed(2)}<br>
    Valence: ${d.valence.toFixed(2)} | Acousticness: ${d.acousticness.toFixed(2)}
  `;
}

function normalized(d, feature) {
  return d[`n_${feature}`];
}

function colorScale(data, feature) {
  const extent = d3.extent(data, d => d[feature]);
  if (extent[0] === extent[1]) return () => "#2563eb";
  return d3.scaleSequential(extent, d3.interpolateTurbo);
}

function clear(selector) {
  d3.select(selector).selectAll("*").remove();
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json();
}

async function postJson(url, payload) {
  const response = await fetch(url, {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify(payload)
  });
  if (!response.ok) throw new Error(`Request failed: ${url}`);
  return response.json();
}

function sampleSizeInput() {
  const input = document.querySelector("#sample-size");
  const value = Number(input.value);
  const size = Math.max(100, Math.min(Number.isFinite(value) ? value : 5000, 15000));
  input.value = size;
  return size;
}

async function generateSample(size) {
  const status = document.querySelector("#sample-status");
  const startButton = document.querySelector("#start-sample");
  const panelButton = document.querySelector("#new-sample");
  status.textContent = `Generating random sample of ${size.toLocaleString()} tracks...`;
  startButton.disabled = true;
  panelButton.disabled = true;
  try {
    state.metadata = await postJson("/api/sample", {size});
    state.hasSample = true;
    document.querySelector("#sample-modal").classList.add("hidden");
    await update(false);
  } finally {
    startButton.disabled = false;
    panelButton.disabled = false;
    status.textContent = "";
  }
}

function currentFilters() {
  const a = +document.querySelector("#year-min").value;
  const b = +document.querySelector("#year-max").value;
  return {
    yearMin: Math.min(a, b),
    yearMax: Math.max(a, b),
    popularity: +document.querySelector("#popularity").value,
    colorBy: document.querySelector("#color-by").value
  };
}

async function loadData() {
  const filters = currentFilters();
  state.colorBy = filters.colorBy;
  const params = new URLSearchParams({
    year_min: filters.yearMin,
    year_max: filters.yearMax,
    min_popularity: filters.popularity,
    limit: Math.min(state.metadata?.sample_size ?? 15000, 15000)
  });

  if (!state.metadata) {
    [state.metadata, state.genres, state.years] = await Promise.all([
      fetchJson("/api/metadata"),
      fetchJson("/api/genres?limit=1200&min_popularity=15"),
      fetchJson("/api/years")
    ]);
  }
  if (state.metadata && !state.metadata.using_session_sample && !state.hasSample) return;
  state.tracks = await fetchJson(`/api/tracks?${params}`);
}

function updateControlLabels() {
  document.querySelector("#year-min-value").textContent = document.querySelector("#year-min").value;
  document.querySelector("#year-max-value").textContent = document.querySelector("#year-max").value;
  document.querySelector("#popularity-value").textContent = document.querySelector("#popularity").value;
}

function drawStats() {
  const stats = [
    [state.tracks.length.toLocaleString(), "filtered tracks displayed"],
    [(state.metadata.sample_size ?? state.metadata.track_count).toLocaleString(), "current random sample"],
    [state.metadata.genre_count.toLocaleString(), "processed genres"],
    [d3.format(".1%")(state.metadata.track_pca_variance.pca1), "track PCA component 1"]
  ];

  d3.select("#stats")
    .selectAll("div")
    .data(stats)
    .join("div")
    .attr("class", "stat")
    .html(d => `<strong>${d[0]}</strong><span>${d[1]}</span>`);
}

function drawRadViz() {
  clear("#radviz");
  const data = state.tracks;
  const features = state.metadata.radial_features;
  const width = 680;
  const height = 560;
  const radius = 210;
  const color = colorScale(data, state.colorBy);
  const anchors = features.map((feature, i) => {
    const angle = (i / features.length) * Math.PI * 2 - Math.PI / 2;
    return {feature, x: Math.cos(angle), y: Math.sin(angle)};
  });
  const positioned = data.map(d => {
    let sx = 0;
    let sy = 0;
    let sw = 0;
    for (const a of anchors) {
      const w = normalized(d, a.feature);
      sx += w * a.x;
      sy += w * a.y;
      sw += w;
    }
    return {...d, rx: sw ? sx / sw : 0, ry: sw ? sy / sw : 0};
  });

  const svg = d3.select("#radviz").append("svg").attr("viewBox", [0, 0, width, height]);
  const g = svg.append("g").attr("transform", `translate(${width / 2},${height / 2 + 10})`);

  g.append("circle").attr("r", radius).attr("fill", "#f8fafc").attr("stroke", "#334155");
  g.selectAll("line.anchor")
    .data(anchors)
    .join("line")
    .attr("x1", 0)
    .attr("y1", 0)
    .attr("x2", d => d.x * radius)
    .attr("y2", d => d.y * radius)
    .attr("stroke", "#cbd5e1")
    .attr("stroke-dasharray", "3,3");
  g.selectAll("circle.anchor")
    .data(anchors)
    .join("circle")
    .attr("cx", d => d.x * radius)
    .attr("cy", d => d.y * radius)
    .attr("r", 7)
    .attr("fill", "#0f172a");
  g.selectAll("text.anchor")
    .data(anchors)
    .join("text")
    .attr("x", d => d.x * (radius + 18))
    .attr("y", d => d.y * (radius + 18))
    .attr("text-anchor", d => d.x > 0.2 ? "start" : d.x < -0.2 ? "end" : "middle")
    .attr("dominant-baseline", "middle")
    .attr("class", "axis-label")
    .text(d => featureLabels.get(d.feature));

  g.selectAll("circle.track")
    .data(positioned)
    .join("circle")
    .attr("cx", d => d.rx * radius)
    .attr("cy", d => d.ry * radius)
    .attr("r", 3)
    .attr("fill", d => color(d[state.colorBy]))
    .attr("fill-opacity", 0.55)
    .attr("stroke", "white")
    .attr("stroke-width", 0.25)
    .on("mouseenter", function(event, d) {
      d3.select(this).raise().attr("r", 7).attr("fill-opacity", 1);
      showTooltip(event, trackTooltip(d));
    })
    .on("mousemove", event => showTooltip(event, tooltip.html()))
    .on("mouseleave", function() {
      d3.select(this).attr("r", 3).attr("fill-opacity", 0.55);
      hideTooltip();
    });
}

function drawStarCoordinates() {
  clear("#star");

  const data = state.tracks;
  const features = state.metadata.radial_features;

  const weights = new Map([
    ["danceability", 1.25],
    ["energy", 1.25],
    ["valence", 1.0],
    ["acousticness", 1.15],
    ["instrumentalness", 0.9],
    ["speechiness", 0.85]
  ]);

  const axes = features.map((feature, i) => {
    const angle = (i / features.length) * Math.PI * 2 - Math.PI / 2;
    const weight = weights.get(feature) ?? 1;

    return {
      feature,
      weight,
      x: Math.cos(angle) * weight,
      y: Math.sin(angle) * weight
    };
  });

  const positioned = data.map(d => {
    let sx = 0;
    let sy = 0;

    for (const axis of axes) {
      const v = normalized(d, axis.feature) - 0.5;
      sx += v * axis.x;
      sy += v * axis.y;
    }

    return { ...d, sx, sy };
  });

  const width = 900;
  const height = 520;

  const margin = {
    top: 40,
    right: 150,
    bottom: 50,
    left: 170
  };

  const x = d3.scaleLinear()
    .domain(d3.extent(positioned, d => d.sx))
    .nice()
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain(d3.extent(positioned, d => d.sy))
    .nice()
    .range([height - margin.bottom, margin.top]);

  const color = colorScale(data, state.colorBy);

  const svg = d3.select("#star")
    .append("svg")
    .attr("viewBox", [0, 0, width, height]);

  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#f8fafc");

  const origin = [x(0), y(0)];

  svg.append("g")
    .selectAll("circle")
    .data(positioned)
    .join("circle")
    .attr("cx", d => x(d.sx))
    .attr("cy", d => y(d.sy))
    .attr("r", 3.2)
    .attr("fill", d => color(d[state.colorBy]))
    .attr("fill-opacity", 0.55)
    .attr("stroke", "white")
    .attr("stroke-width", 0.3)
    .on("mouseenter", function(event, d) {

      d3.select(this)
        .raise()
        .attr("r", 7)
        .attr("fill-opacity", 1);

      showTooltip(event, trackTooltip(d));
    })
    .on("mousemove", event => showTooltip(event, tooltip.html()))
    .on("mouseleave", function() {

      d3.select(this)
        .attr("r", 3.2)
        .attr("fill-opacity", 0.55);

      hideTooltip();
    });

  const axisGroup = svg.append("g");

  axisGroup.selectAll("line")
    .data(axes)
    .join("line")
    .attr("x1", origin[0])
    .attr("y1", origin[1])
    .attr("x2", d => x(d.x * 0.45))
    .attr("y2", d => y(d.y * 0.45))
    .attr("stroke", "#1e293b")
    .attr("stroke-width", d => 1.2 + d.weight)
    .attr("stroke-opacity", 0.85);

  const labels = axisGroup.selectAll("g.label")
    .data(axes)
    .join("g")
    .attr("transform", d => {
      const lx = x(d.x * 0.52);
      const ly = y(d.y * 0.52);
      return `translate(${lx},${ly})`;
    });

  labels.append("text")
    .attr("text-anchor", d => d.x > 0 ? "start" : "end")
    .attr("dominant-baseline", "middle")
    .attr("font-size", 14)
    .attr("font-weight", 700)
    .attr("paint-order", "stroke")
    .attr("stroke", "#f8fafc")
    .attr("stroke-width", 5)
    .attr("stroke-linejoin", "round")
    .attr("fill", "#0f172a")
    .text(d => `${featureLabels.get(d.feature)} × ${d.weight}`);

  svg.append("circle")
    .attr("cx", origin[0])
    .attr("cy", origin[1])
    .attr("r", 4)
    .attr("fill", "#0f172a");

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 28)
    .attr("font-size", 18)
    .attr("font-weight", 800)
    .attr("fill", "#0f172a")
    .text("Star Coordinates Projection");
}

function drawParallelCoordinates() {
  clear("#parallel");

  const data = state.tracks;
  const dims = state.metadata.features;

  const width = 1100;
  const height = 560;

  const margin = {
    top: 72,
    right: 40,
    bottom: 36,
    left: 54
  };

  const innerHeight = height - margin.top - margin.bottom;

  const activeBrushes = new Map();

  const x = d3.scalePoint()
    .domain(dims)
    .range([margin.left, width - margin.right])
    .padding(0.45);

  const y = new Map(
    dims.map(dim => [
      dim,
      d3.scaleLinear()
        .domain([0, 1])
        .range([margin.top + innerHeight, margin.top])
    ])
  );

  const line = d3.line()
    .defined(([, value]) => Number.isFinite(value))
    .x(([dim]) => x(dim))
    .y(([dim, value]) => y.get(dim)(value));

  const color = colorScale(data, state.colorBy);

  const svg = d3.select("#parallel")
    .append("svg")
    .attr("viewBox", [0, 0, width, height]);

  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#f8fafc");

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 34)
    .attr("font-size", 22)
    .attr("font-weight", 800)
    .attr("fill", "#0f172a")
    .text("Parallel Coordinates");

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 560)
    .attr("font-size", 12)
    .attr("fill", "#475569")
    .text("Brush over axes to filter tracks.");

  const isSelected = d => {
    for (const [dim, [lo, hi]] of activeBrushes) {

      const value = normalized(d, dim);

      if (
        !Number.isFinite(value) ||
        value < lo ||
        value > hi
      ) {
        return false;
      }
    }

    return true;
  };

  const pathGroup = svg.append("g")
    .attr("fill", "none")
    .attr("stroke-linecap", "round")
    .attr("stroke-linejoin", "round");

  const path = pathGroup
    .selectAll("path")
    .data(data)
    .join("path")
    .attr(
      "d",
      d => line(
        dims.map(dim => [
          dim,
          normalized(d, dim)
        ])
      )
    )
    .attr("stroke", d => color(d[state.colorBy]))
    .attr("stroke-width", 0.65)
    .attr("stroke-opacity", 0.12)
    .on("mouseenter", function(event, d) {

      d3.select(this)
        .raise()
        .attr("stroke-width", 3)
        .attr("stroke-opacity", 0.95);

      showTooltip(event, trackTooltip(d));
    })
    .on("mousemove", event => {
      showTooltip(event, tooltip.html());
    })
    .on("mouseleave", function(event, d) {

      d3.select(this)
        .attr(
          "stroke-width",
          activeBrushes.size && isSelected(d)
            ? 1.25
            : 0.65
        )
        .attr(
          "stroke-opacity",
          activeBrushes.size
            ? (isSelected(d) ? 0.65 : 0.025)
            : 0.12
        );

      hideTooltip();
    });

  const updateBrush = () => {

    path
      .attr("stroke-opacity", d => {

        if (activeBrushes.size === 0) {
          return 0.12;
        }

        return isSelected(d)
          ? 0.65
          : 0.025;
      })
      .attr("stroke-width", d => {

        if (activeBrushes.size === 0) {
          return 0.65;
        }

        return isSelected(d)
          ? 1.25
          : 0.55;
      });
  };

  const axisGroup = svg.append("g");

  const axis = axisGroup
    .selectAll("g.axis")
    .data(dims)
    .join("g")
    .attr("class", "axis")
    .attr(
      "transform",
      d => `translate(${x(d)},0)`
    );

  axis.each(function(dim) {

    d3.select(this)
      .call(
        d3.axisLeft(y.get(dim))
          .ticks(5)
          .tickSize(4)
          .tickFormat(d3.format(".1f"))
      )
      .call(g =>
        g.select(".domain")
          .attr("stroke", "#0f172a")
          .attr("stroke-width", 1.1)
      )
      .call(g =>
        g.selectAll(".tick line")
          .attr("stroke", "#94a3b8")
      )
      .call(g =>
        g.selectAll(".tick text")
          .attr("fill", "#334155")
          .attr("font-size", 11)
      );
  });

  axis.append("text")
    .attr("x", 0)
    .attr("y", margin.top - 22)
    .attr("text-anchor", "middle")
    .attr("fill", "#0f172a")
    .attr("font-size", 11)
    .attr("font-weight", 800)
    .text(d => featureLabels.get(d) ?? d);

  axis.append("g")
    .attr("class", "brush")
    .each(function(dim) {

      d3.select(this).call(

        d3.brushY()
          .extent([
            [-16, margin.top],
            [16, margin.top + innerHeight]
          ])
          .on("brush end", event => {

            if (event.selection) {

              const [y0, y1] = event.selection;

              activeBrushes.set(dim, [
                y.get(dim).invert(y1),
                y.get(dim).invert(y0)
              ]);

            } else {

              activeBrushes.delete(dim);
            }

            updateBrush();
          })
      );
    });

  axis.selectAll(".selection")
    .attr("fill", "#334155")
    .attr("fill-opacity", 0.18)
    .attr("stroke", "#0f172a");

  axis.selectAll(".handle")
    .attr("fill", "#0f172a");
}

function drawPca() {
  clear("#pca");
  const data = state.tracks;
  const width = 680;
  const height = 560;
  const margin = {top: 28, right: 28, bottom: 52, left: 58};
  const x = d3.scaleLinear(d3.extent(data, d => d.pca1), [margin.left, width - margin.right]).nice();
  const y = d3.scaleLinear(d3.extent(data, d => d.pca2), [height - margin.bottom, margin.top]).nice();
  const color = colorScale(data, state.colorBy);
  const svg = d3.select("#pca").append("svg").attr("viewBox", [0, 0, width, height]);
  svg.append("rect").attr("width", width).attr("height", height).attr("fill", "#f8fafc");
  svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).ticks(7));
  svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(7));
  svg.append("text")
    .attr("x", width - margin.right)
    .attr("y", height - 10)
    .attr("text-anchor", "end")
    .attr("class", "axis-label")
    .text(`PC1 ${d3.format(".1%")(state.metadata.track_pca_variance.pca1)}`);
  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 18)
    .attr("class", "axis-label")
    .text(`PC2 ${d3.format(".1%")(state.metadata.track_pca_variance.pca2)}`);
  svg.selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", d => x(d.pca1))
    .attr("cy", d => y(d.pca2))
    .attr("r", 3.1)
    .attr("fill", d => color(d[state.colorBy]))
    .attr("fill-opacity", 0.56)
    .attr("stroke", "white")
    .attr("stroke-width", 0.25)
    .on("mouseenter", function(event, d) {
      d3.select(this).raise().attr("r", 7).attr("fill-opacity", 1);
      showTooltip(event, trackTooltip(d));
    })
    .on("mousemove", event => showTooltip(event, tooltip.html()))
    .on("mouseleave", function() {
      d3.select(this).attr("r", 3.1).attr("fill-opacity", 0.56);
      hideTooltip();
    });
}

function drawGenres() {
  clear("#genres");

  const data = state.genres;

  const width = 920;
  const height = 560;

  const margin = {
    top: 80,
    right: 130,
    bottom: 64,
    left: 72
  };

  const x = d3.scaleLinear()
    .domain([0, 1])
    .range([margin.left, width - margin.right]);

  const y = d3.scaleLinear()
    .domain([0, 1])
    .range([height - margin.bottom, margin.top]);

  const r = d3.scaleSqrt()
    .domain(d3.extent(data, d => d.popularity))
    .range([3, 20]);

  const color = d3.scaleSequential()
    .domain([0, 1])
    .interpolator(d3.interpolateRdYlBu);

  const svg = d3.select("#genres")
    .append("svg")
    .attr("viewBox", [0, 0, width, height]);

  svg.append("rect")
    .attr("width", width)
    .attr("height", height)
    .attr("fill", "#f8fafc");

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 34)
    .attr("font-size", 22)
    .attr("font-weight", 800)
    .attr("fill", "#0f172a")
    .text("Genre contrast: acoustic vs energetic");

  svg.append("text")
    .attr("x", margin.left)
    .attr("y", 560)
    .attr("font-size", 12)
    .attr("fill", "#475569")
    .text("Bubble size represents popularity. Color represents danceability.");

  svg.append("g")
    .attr("transform", `translate(0,${height - margin.bottom})`)
    .call(
      d3.axisBottom(x)
        .ticks(6)
        .tickSize(-(height - margin.top - margin.bottom))
    )
    .call(g => g.selectAll(".tick line")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.55)
    )
    .call(g => g.select(".domain")
      .attr("stroke", "#0f172a")
    )
    .call(g => g.selectAll(".tick text")
      .attr("fill", "#334155")
    )
    .call(g => g.append("text")
      .attr("x", width - margin.right)
      .attr("y", 44)
      .attr("text-anchor", "end")
      .attr("fill", "#0f172a")
      .attr("font-size", 13)
      .attr("font-weight", 800)
      .text("Energy"));

  svg.append("g")
    .attr("transform", `translate(${margin.left},0)`)
    .call(
      d3.axisLeft(y)
        .ticks(6)
        .tickSize(-(width - margin.left - margin.right))
    )
    .call(g => g.selectAll(".tick line")
      .attr("stroke", "#cbd5e1")
      .attr("stroke-opacity", 0.55)
    )
    .call(g => g.select(".domain")
      .attr("stroke", "#0f172a")
    )
    .call(g => g.selectAll(".tick text")
      .attr("fill", "#334155")
    )
    .call(g => g.append("text")
      .attr("x", 0)
      .attr("y", margin.top - 22)
      .attr("text-anchor", "start")
      .attr("fill", "#0f172a")
      .attr("font-size", 13)
      .attr("font-weight", 800)
      .text("Acousticness"));

  svg.append("g")
    .selectAll("circle")
    .data(data)
    .join("circle")
    .attr("cx", d => x(normalized(d, "energy")))
    .attr("cy", d => y(normalized(d, "acousticness")))
    .attr("r", d => r(d.popularity))
    .attr("fill", d => color(normalized(d, "danceability")))
    .attr("fill-opacity", 0.42)
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 0.8)
    .attr("stroke-opacity", 0.22)
    .on("mouseenter", function(event, d) {

      d3.select(this)
        .raise()
        .attr("fill-opacity", 0.9)
        .attr("stroke-opacity", 0.85)
        .attr("stroke-width", 1.5);

      showTooltip(
        event,
        `<strong>${d.genre}</strong><br>
        Popularity: ${d.popularity.toFixed(1)}<br>
        Energy: ${d.energy.toFixed(2)}<br>
        Acousticness: ${d.acousticness.toFixed(2)}<br>
        Danceability: ${d.danceability.toFixed(2)}`
      );
    })
    .on("mousemove", event => showTooltip(event, tooltip.html()))
    .on("mouseleave", function() {

      d3.select(this)
        .attr("fill-opacity", 0.42)
        .attr("stroke-opacity", 0.22)
        .attr("stroke-width", 0.8);

      hideTooltip();
    });
}

function drawYears() {
  clear("#years");
  const data = state.years;
  const features = ["energy", "danceability", "acousticness", "valence"];
  const width = 680;
  const height = 420;
  const margin = {top: 28, right: 112, bottom: 42, left: 52};
  const x = d3.scaleLinear(d3.extent(data, d => d.year), [margin.left, width - margin.right]);
  const y = d3.scaleLinear([0, 1], [height - margin.bottom, margin.top]);
  const color = d3.scaleOrdinal(features, ["#ef4444", "#2563eb", "#10b981", "#f59e0b"]);
  const line = d3.line().x(d => x(d.year)).y(d => y(d.value));
  const series = features.map(feature => ({
    feature,
    values: data.map(d => ({year: d.year, value: d[feature]}))
  }));
  const svg = d3.select("#years").append("svg").attr("viewBox", [0, 0, width, height]);
  svg.append("rect").attr("width", width).attr("height", height).attr("fill", "#fff");
  svg.append("g").attr("transform", `translate(0,${height - margin.bottom})`).call(d3.axisBottom(x).tickFormat(d3.format("d")));
  svg.append("g").attr("transform", `translate(${margin.left},0)`).call(d3.axisLeft(y).ticks(5));
  svg.selectAll("path.line")
    .data(series)
    .join("path")
    .attr("fill", "none")
    .attr("stroke", d => color(d.feature))
    .attr("stroke-width", 2.4)
    .attr("d", d => line(d.values));
  const legend = svg.selectAll("g.legend")
    .data(features)
    .join("g")
    .attr("transform", (d, i) => `translate(${width - margin.right + 18},${margin.top + i * 24})`);
  legend.append("circle").attr("r", 5).attr("fill", d => color(d));
  legend.append("text").attr("x", 10).attr("y", 4).attr("class", "axis-label").text(d => featureLabels.get(d));
}

function renderAll() {
  drawStats();
  drawRadViz();
  drawStarCoordinates();
  drawParallelCoordinates();
  drawPca();
  drawGenres();
  drawYears();
}

async function update(allowFallbackLoad = true) {
  updateControlLabels();
  if (!allowFallbackLoad && !state.metadata) return;
  await loadData();
  if (!state.tracks.length) return;
  renderAll();
}

document.querySelector("#reload").addEventListener("click", () => update(true));
document.querySelector("#start-sample").addEventListener("click", () => generateSample(sampleSizeInput()));
document.querySelector("#new-sample").addEventListener("click", () => generateSample(sampleSizeInput()));
for (const id of ["#year-min", "#year-max", "#popularity"]) {
  document.querySelector(id).addEventListener("input", updateControlLabels);
}
document.querySelector("#color-by").addEventListener("change", () => update(true));

updateControlLabels();

loadData().then(() => {
  if (state.metadata?.using_session_sample) {
    state.hasSample = true;
    document.querySelector("#sample-modal").classList.add("hidden");
    return update(true);
  }
}).catch(error => {
  console.error(error);
  document.querySelector("main").insertAdjacentHTML(
    "afterbegin",
    `<section class="panel" style="padding: 18px; color: #991b1b;"><strong>App error:</strong> ${error.message}</section>`
  );
});
