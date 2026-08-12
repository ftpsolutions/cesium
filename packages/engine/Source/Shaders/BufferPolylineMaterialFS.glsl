in vec4 v_pickColor;
in vec4 v_color;
in vec4 v_gapColor;
in float v_along;      // 0..1 along the line, anchored to the geometry
in float v_dashRepeat; // integer part = cycles along the line, fractional part = phase offset
in float v_dashPattern;

// Number of on/off slots in one dash cycle; matches the 16-bit v_dashPattern.
const float maskLength = 16.0;

void main()
{
    vec4 fragColor = v_color;

    // Geometry-anchored dash: walk `dashRepeat` pattern cycles along the line
    // (v_along, 0..1) and read the matching bit out of the 16-bit v_dashPattern.
    // Sampling along the geometry (rather than gl_FragCoord) keeps the bands
    // fixed to the line as the camera pans and scales them with the line as it
    // zooms. `dashOffset` phase-shifts the pattern (e.g. 0.25 lands a solid slot
    // on the origin). A solid line uses an all-ones pattern (0xFFFF), so this
    // never selects the gap.
    float dashRepeat = floor(v_dashRepeat);
    float dashOffset = fract(v_dashRepeat);
    float dashPosition = fract(v_along * dashRepeat + dashOffset);
    float maskIndex = floor(dashPosition * maskLength);
    float maskTest = floor(v_dashPattern / pow(2.0, maskIndex));
    if (mod(maskTest, 2.0) < 1.0)
    {
        fragColor = v_gapColor;
    }

    if (fragColor.a < 0.005)   // matches 0/255 and 1/255
    {
        discard;
    }

    out_FragColor = czm_gammaCorrect(fragColor);
    czm_writeLogDepth();
}
