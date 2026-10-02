// Reference-style longitudinal and occlusal illustrations. Treatment overlays
// remain vector geometry so each tooth and restoration stays interactive.
window.DentalArt = (() => {
  let serial = 0;
  const colors = {existing:'#10b9c5',planned:'#8228a8',progress:'#2664bd',rejected:'#c63a54',completed:'#4cad83'};
  function anatomy(number, record, lower) {
    const position = number % 10;
    const molar = position >= 6;
    const premolar = position === 4 || position === 5;
    const tip = position === 3 ? 3 : premolar ? (position === 4 ? 15 : 23) : 7;
    const uid = `long-${number}-${++serial}`;
    // The reference uses short, broad molars and much longer anterior roots.
    let body = molar
      ? 'M8 40 C4 40 4 52 5 63 L3 85 Q2 93 9 94 Q15 92 21 94 Q28 92 34 94 Q40 92 38 85 L36 63 C38 53 38 42 34 40 C31 42 34 56 29 63 C25 60 28 44 24 40 Q21 37 19 41 C17 47 21 59 16 63 C11 58 13 44 10 41 Z'
      : `M20 ${tip} Q21 ${tip-3} 22 ${tip} C24 30 24 55 28 70 Q30 75 32 80 L31 91 Q28 96 21 94 Q14 96 11 91 L10 80 Q14 71 15 62 Z`;
    let pulp = molar
      ? 'M8 45 C6 56 9 69 13 72 L11 78 L31 78 L29 72 C34 68 36 56 34 45 L32 47 C33 58 30 68 26 67 C22 64 25 48 22 44 C20 46 22 61 19 66 C15 70 9 62 10 47 Z'
      : `M21 ${tip+6} C22 35 21 58 25 72 L27 78 L16 78 L18 71 C20 47 19 29 21 ${tip+6} Z`;
    if (molar && lower) {
      body = 'M8 40 Q5 39 5 47 L5 68 L3 85 Q2 94 10 94 Q21 92 32 94 Q40 94 38 85 L36 68 L36 47 Q36 39 33 40 C29 48 31 65 25 69 Q21 73 17 69 C11 65 13 48 8 40 Z';
      pulp = 'M8 46 C7 57 9 72 11 79 L31 79 C33 69 35 55 33 46 C30 55 32 70 25 73 Q21 76 17 73 C10 69 12 55 8 46 Z';
    }
    const crown = molar
      ? 'M5 80 Q12 83 21 82 Q31 83 37 80 L37 87 Q38 93 32 92 Q25 91 21 93 Q15 91 9 92 Q3 93 4 87 Z'
      : 'M11 80 Q21 83 31 80 L30 89 Q29 94 21 93 Q13 94 12 89 Z';
    const color = colors[record.status];
    let treatment = '';
    if (record.treatment === 'root-canal') treatment = `<path d="${pulp}" fill="${color}" opacity=".9"/>`;
    if (record.treatment === 'crown' || record.treatment === 'bridge') treatment = `<path d="${crown}" fill="${color}" fill-opacity=".13" stroke="${color}" stroke-width="2"/>${record.treatment === 'bridge' ? `<path d="M2 85 H40" stroke="${color}" stroke-width="2"/>` : ''}`;
    if (record.treatment === 'filling') treatment = `<path d="M16 84 Q21 82 26 84 L25 89 L17 89 Z" fill="${color}"/>`;
    if (record.treatment === 'extraction') treatment = `<path d="M9 48 L33 89 M33 48 L9 89" stroke="${color}" stroke-width="3" stroke-linecap="round"/>`;
    if (record.treatment === 'implant') treatment = `<path d="M18 36 L25 36 L24 78 L19 78 Z" fill="${color}" fill-opacity=".22" stroke="${color}"/><path d="M16 42 L27 47 M16 51 L27 56 M17 60 L26 65 M17 69 L26 74" stroke="${color}" stroke-width="1.6"/>`;
    if (record.treatment === 'cleaning') treatment = `<path d="M21 83 V91 M17 87 H25" stroke="${color}" stroke-width="1.6"/>`;
    return `<svg class="tooth-anatomy" viewBox="0 0 42 98" aria-hidden="true"><defs><linearGradient id="${uid}" x1="0" x2="1"><stop stop-color="#e6edef"/><stop offset=".28" stop-color="#fff"/><stop offset=".73" stop-color="#f4f8f9"/><stop offset="1" stop-color="#dce6e9"/></linearGradient></defs><g${lower ? ' transform="translate(0 98) scale(1 -1)"' : ''}><path d="${body}" fill="url(#${uid})" stroke="#e0e8eb" stroke-width="1.1"/><path d="${pulp}" fill="#d98595"/><path d="${pulp}" fill="none" stroke="#f0bdc5" stroke-width="1"/><path d="${crown}" fill="#f2f7f9" stroke="#e2e9ed" stroke-width=".7"/><path d="M8 86 Q21 88 34 86" fill="none" stroke="white" stroke-width="1.5" opacity=".85"/>${treatment}</g></svg>`;
  }
  function occlusal(number) {
    const position = number % 10;
    const uid = `occlusal-${number}-${++serial}`;
    const molar = position >= 6;
    const outer = molar
      ? 'M7 8 Q11 4 18 6 Q24 3 32 7 Q39 10 37 20 Q37 31 29 36 Q20 40 11 35 Q5 31 4 21 Q2 13 7 8 Z'
      : position >= 4
        ? 'M11 7 Q21 2 31 8 Q37 14 34 26 Q31 36 21 38 Q10 36 7 26 Q4 14 11 7 Z'
        : 'M11 8 Q20 4 30 8 Q34 12 31 24 Q29 35 21 37 Q12 35 9 24 Q6 12 11 8 Z';
    const lobes = molar
      ? '<path d="M8 12 Q13 7 19 11 L19 19 Q12 22 8 17 Z"/><path d="M23 10 Q30 7 33 13 L31 20 L23 18 Z"/><path d="M9 24 L18 23 L19 32 Q11 33 9 24 Z"/><path d="M24 23 L32 23 Q31 31 24 33 L22 28 Z"/>'
      : position >= 4
        ? '<path d="M11 12 Q20 5 27 11 L23 19 L16 20 Z"/><path d="M12 25 L19 22 L27 25 Q25 33 20 33 Q15 32 12 25 Z"/>'
        : '<path d="M12 11 Q21 7 29 11 L26 19 L16 19 Z"/><path d="M16 23 Q21 26 26 23 L24 31 Q20 35 17 30 Z"/>';
    const fissures = molar ? 'M9 20 Q17 24 21 20 Q25 17 33 21 M21 11 Q18 19 21 22 L22 32' : 'M12 21 Q20 24 29 21 M21 13 L20 28';
    return {outer,clipId:`${uid}-clip`,markup:`<defs><radialGradient id="${uid}" cx="45%" cy="38%" r="70%"><stop stop-color="#fff"/><stop offset=".58" stop-color="#f0f5f6"/><stop offset="1" stop-color="#d6e2e7"/></radialGradient><clipPath id="${uid}-clip"><path d="${outer}"/></clipPath></defs><path d="${outer}" fill="url(#${uid})" stroke="#e0e8ec" stroke-width="1.3"/><g fill="#fff" stroke="#e7eef0" stroke-width=".6" opacity=".95">${lobes}</g><path d="${fissures}" fill="none" stroke="#cbd8dd" stroke-width=".9" opacity=".65"/><path d="${outer}" fill="none" stroke="#edf3f5" stroke-width="1.7"/>`};
  }
  return {anatomy,occlusal};
})();
