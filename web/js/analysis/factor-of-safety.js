(function (root) {
  'use strict';

  function positive(value) { return Number.isFinite(value) && value > 0 ? value : null; }

  function selectYieldStrength(material) {
    var tensile = positive(material && material.tensileYieldPa);
    var compressive = positive(material && material.compressiveYieldPa);
    if (tensile && compressive) {
      return { available: true, valuePa: Math.min(tensile, compressive),
        source: tensile <= compressive ? 'tensile-yield-minimum' : 'compressive-yield-minimum' };
    }
    if (tensile) { return { available: true, valuePa: tensile, source: 'tensile-yield' }; }
    if (compressive) { return { available: true, valuePa: compressive, source: 'compressive-yield' }; }
    return { available: false, valuePa: null, source: 'unavailable' };
  }

  function factor(strength, stress) { return stress === 0 ? Infinity : strength / Math.abs(stress); }

  function deriveFactorOfSafety(result, material, contourCeiling) {
    var strength = selectYieldStrength(material);
    var rawStress;
    var surfaceStress;
    var raw;
    var surface;
    var contour;
    var minimum = Infinity;
    var sampleIndex = 0;
    var displayedMinimum = Infinity;
    var displayedMaximum = -Infinity;
    var minimumNode = -1;
    var maximumNode = -1;
    var index;
    if (!strength.available) { return null; }
    rawStress = result.recoverySampleFields.vonMisesPa;
    surfaceStress = result.surfaceFields.vonMisesPa;
    contourCeiling = Number.isFinite(contourCeiling) && contourCeiling > 0 ? contourCeiling : 10;
    raw = new Float64Array(rawStress.length);
    surface = new Float32Array(surfaceStress.length);
    contour = new Float32Array(surfaceStress.length);
    for (index = 0; index < raw.length; index += 1) {
      raw[index] = factor(strength.valuePa, rawStress[index]);
      if (raw[index] < minimum) { minimum = raw[index]; sampleIndex = index; }
    }
    for (index = 0; index < surface.length; index += 1) {
      surface[index] = factor(strength.valuePa, surfaceStress[index]);
      contour[index] = Math.min(surface[index], contourCeiling);
    }
    var boundary = result.originalSurface && result.originalSurface.triangleConnectivity;
    if (!(boundary instanceof Uint32Array) || !boundary.length || boundary.length % 3) {
      throw new Error('Factor of safety requires valid result boundary triangles.');
    }
    for (index = 0; index < boundary.length; index += 1) {
      var node = boundary[index];
      if (node >= surface.length || !Number.isFinite(surfaceStress[node]) || surfaceStress[node] < 0) {
        throw new Error('Factor of safety requires finite nonnegative boundary stresses.');
      }
      if (surface[node] < displayedMinimum || minimumNode < 0) { displayedMinimum = surface[node]; minimumNode = node; }
      if (surface[node] > displayedMaximum) { displayedMaximum = surface[node]; maximumNode = node; }
    }
    return {
      criterion: 'von-mises-yield', strength: strength,
      rawValues: raw, surfaceValues: surface, contourValues: contour,
      contourCeiling: contourCeiling,
      rawMinimum: { value: minimum, sampleIndex: sampleIndex, locationOwner: 'solver-sample',
        elementIndex: result.recoverySampleFields.elementIndices[sampleIndex] },
      displayedMinimum: displayedMinimum,
      displayedRange: { minimum: displayedMinimum, maximum: displayedMaximum, locationOwner: 'surface-node',
        minimumNodeIndex: minimumNode, maximumNodeIndex: maximumNode }
    };
  }

  function singleSolveWarnings(result, material) {
    var warnings = Array.isArray(result.warnings) ? result.warnings.slice() : [];
    var diagonal = result.meshStatistics && result.meshStatistics.boundingBoxDiagonalM;
    if (Number.isFinite(diagonal) && diagonal > 0 &&
        result.extrema.maxDisplacement.valueM > diagonal * 0.05 &&
        warnings.indexOf('Displacement exceeds 5% of the model diagonal; geometric nonlinearity may matter.') < 0) {
      warnings.push('Displacement exceeds 5% of the model diagonal; geometric nonlinearity may matter.');
    }
    if (material && Number.isFinite(material.poissonsRatio) && material.poissonsRatio > 0.45) {
      warnings.push('Poisson ratio is near incompressible; displacement-based tetrahedra may lock.');
    }
    return warnings;
  }

  function decorateResultWithTrust(result, material) {
    var factorOfSafety = deriveFactorOfSafety(result, material, 10);
    var decorated = Object.assign({}, result, {
      warnings: singleSolveWarnings(result, material),
      assumptions: ['small-strain', 'linear-elastic', 'static', 'single-isotropic-solid'],
      convergenceStatus: 'not-run',
      factorOfSafety: factorOfSafety
    });
    if (factorOfSafety) {
      var surfaceRange = factorOfSafety.displayedRange;
      var positions = result.originalSurface.nodePositionsM;
      surfaceRange.minimumLocationM = Array.prototype.slice.call(positions, surfaceRange.minimumNodeIndex * 3, surfaceRange.minimumNodeIndex * 3 + 3);
      surfaceRange.maximumLocationM = Array.prototype.slice.call(positions, surfaceRange.maximumNodeIndex * 3, surfaceRange.maximumNodeIndex * 3 + 3);
      decorated.surfaceFields = Object.assign({}, result.surfaceFields, {
        factorOfSafety: factorOfSafety.contourValues
      });
      decorated.ranges = Object.assign({}, result.ranges, {
        factorOfSafety: Object.assign({}, surfaceRange, {
          minimum: Math.min(surfaceRange.minimum, factorOfSafety.contourCeiling),
          maximum: Math.min(surfaceRange.maximum, factorOfSafety.contourCeiling),
          clipped: surfaceRange.maximum > factorOfSafety.contourCeiling,
          uncappedMinimum: surfaceRange.minimum, uncappedMaximum: surfaceRange.maximum })
      });
      decorated.extrema = Object.assign({}, result.extrema, {
        rawFactorOfSafetyMinimum: Object.assign({}, factorOfSafety.rawMinimum,
          { locationM: result.extrema.rawVonMisesMax.locationM }),
        displayedFactorOfSafetyMinimum: { value: factorOfSafety.displayedMinimum, locationOwner: 'surface-node',
          nodeIndex: factorOfSafety.displayedRange.minimumNodeIndex,
          locationM: Array.prototype.slice.call(result.originalSurface.nodePositionsM,
            factorOfSafety.displayedRange.minimumNodeIndex * 3, factorOfSafety.displayedRange.minimumNodeIndex * 3 + 3) }
      });
    }
    return decorated;
  }

  root.SpjutsimFEA = root.SpjutsimFEA || {};
  root.SpjutsimFEA.selectYieldStrength = selectYieldStrength;
  root.SpjutsimFEA.deriveFactorOfSafety = deriveFactorOfSafety;
  root.SpjutsimFEA.singleSolveWarnings = singleSolveWarnings;
  root.SpjutsimFEA.decorateResultWithTrust = decorateResultWithTrust;
}(globalThis));
