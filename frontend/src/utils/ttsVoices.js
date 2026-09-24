/**
 * The Azure neural voices this app offers.
 *
 * This list used to be five entries hard-coded in AudioPanel: four Brazilian
 * Portuguese and one English. So a scene narrated in English had exactly one
 * voice and no way to get a male one, and Spanish and French — both offered
 * as narration languages — had no voice at all.
 *
 * Generated from Azure's own catalogue for the region this project uses
 * (the voices/list endpoint), filtered to voices that are GA and non-HD, with
 * the multilingual and preview variants left out: same personas, different
 * billing, and they lengthen a picker that is already long.
 *
 * To regenerate: fetch that endpoint and keep the locales below, VoiceType
 * 'Neural' and Status 'GA'.
 */

/** @typedef {{id: string, name: string, gender: 'f'|'m', locale: string}} TtsVoice */

/** @type {TtsVoice[]} */
export const TTS_VOICES = [
  { id: 'pt-BR-FranciscaNeural', name: 'Francisca', gender: 'f', locale: 'pt-BR' },
  { id: 'pt-BR-BrendaNeural', name: 'Brenda', gender: 'f', locale: 'pt-BR' },
  { id: 'pt-BR-ElzaNeural', name: 'Elza', gender: 'f', locale: 'pt-BR' },
  { id: 'pt-BR-GiovannaNeural', name: 'Giovanna', gender: 'f', locale: 'pt-BR' },
  { id: 'pt-BR-LeilaNeural', name: 'Leila', gender: 'f', locale: 'pt-BR' },
  { id: 'pt-BR-LeticiaNeural', name: 'Leticia', gender: 'f', locale: 'pt-BR' },
  { id: 'pt-BR-ManuelaNeural', name: 'Manuela', gender: 'f', locale: 'pt-BR' },
  { id: 'pt-BR-ThalitaNeural', name: 'Thalita', gender: 'f', locale: 'pt-BR' },
  { id: 'pt-BR-YaraNeural', name: 'Yara', gender: 'f', locale: 'pt-BR' },
  { id: 'pt-BR-AntonioNeural', name: 'Antonio', gender: 'm', locale: 'pt-BR' },
  { id: 'pt-BR-DonatoNeural', name: 'Donato', gender: 'm', locale: 'pt-BR' },
  { id: 'pt-BR-FabioNeural', name: 'Fabio', gender: 'm', locale: 'pt-BR' },
  { id: 'pt-BR-HumbertoNeural', name: 'Humberto', gender: 'm', locale: 'pt-BR' },
  { id: 'pt-BR-JulioNeural', name: 'Julio', gender: 'm', locale: 'pt-BR' },
  { id: 'pt-BR-NicolauNeural', name: 'Nicolau', gender: 'm', locale: 'pt-BR' },
  { id: 'pt-BR-ValerioNeural', name: 'Valerio', gender: 'm', locale: 'pt-BR' },
  { id: 'pt-PT-RaquelNeural', name: 'Raquel', gender: 'f', locale: 'pt-PT' },
  { id: 'pt-PT-FernandaNeural', name: 'Fernanda', gender: 'f', locale: 'pt-PT' },
  { id: 'pt-PT-DuarteNeural', name: 'Duarte', gender: 'm', locale: 'pt-PT' },
  { id: 'en-US-AvaNeural', name: 'Ava', gender: 'f', locale: 'en-US' },
  { id: 'en-US-EmmaNeural', name: 'Emma', gender: 'f', locale: 'en-US' },
  { id: 'en-US-JennyNeural', name: 'Jenny', gender: 'f', locale: 'en-US' },
  { id: 'en-US-AriaNeural', name: 'Aria', gender: 'f', locale: 'en-US' },
  { id: 'en-US-JaneNeural', name: 'Jane', gender: 'f', locale: 'en-US' },
  { id: 'en-US-LunaNeural', name: 'Luna', gender: 'f', locale: 'en-US' },
  { id: 'en-US-SaraNeural', name: 'Sara', gender: 'f', locale: 'en-US' },
  { id: 'en-US-NancyNeural', name: 'Nancy', gender: 'f', locale: 'en-US' },
  { id: 'en-US-AmberNeural', name: 'Amber', gender: 'f', locale: 'en-US' },
  { id: 'en-US-AnaNeural', name: 'Ana', gender: 'f', locale: 'en-US' },
  { id: 'en-US-AshleyNeural', name: 'Ashley', gender: 'f', locale: 'en-US' },
  { id: 'en-US-CoraNeural', name: 'Cora', gender: 'f', locale: 'en-US' },
  { id: 'en-US-ElizabethNeural', name: 'Elizabeth', gender: 'f', locale: 'en-US' },
  { id: 'en-US-MichelleNeural', name: 'Michelle', gender: 'f', locale: 'en-US' },
  { id: 'en-US-MonicaNeural', name: 'Monica', gender: 'f', locale: 'en-US' },
  { id: 'en-US-AndrewNeural', name: 'Andrew', gender: 'm', locale: 'en-US' },
  { id: 'en-US-BrianNeural', name: 'Brian', gender: 'm', locale: 'en-US' },
  { id: 'en-US-GuyNeural', name: 'Guy', gender: 'm', locale: 'en-US' },
  { id: 'en-US-DavisNeural', name: 'Davis', gender: 'm', locale: 'en-US' },
  { id: 'en-US-JasonNeural', name: 'Jason', gender: 'm', locale: 'en-US' },
  { id: 'en-US-KaiNeural', name: 'Kai', gender: 'm', locale: 'en-US' },
  { id: 'en-US-TonyNeural', name: 'Tony', gender: 'm', locale: 'en-US' },
  { id: 'en-US-BrandonNeural', name: 'Brandon', gender: 'm', locale: 'en-US' },
  { id: 'en-US-ChristopherNeural', name: 'Christopher', gender: 'm', locale: 'en-US' },
  { id: 'en-US-EricNeural', name: 'Eric', gender: 'm', locale: 'en-US' },
  { id: 'en-US-JacobNeural', name: 'Jacob', gender: 'm', locale: 'en-US' },
  { id: 'en-US-RogerNeural', name: 'Roger', gender: 'm', locale: 'en-US' },
  { id: 'en-US-SteffanNeural', name: 'Steffan', gender: 'm', locale: 'en-US' },
  { id: 'en-GB-SoniaNeural', name: 'Sonia', gender: 'f', locale: 'en-GB' },
  { id: 'en-GB-LibbyNeural', name: 'Libby', gender: 'f', locale: 'en-GB' },
  { id: 'en-GB-AbbiNeural', name: 'Abbi', gender: 'f', locale: 'en-GB' },
  { id: 'en-GB-BellaNeural', name: 'Bella', gender: 'f', locale: 'en-GB' },
  { id: 'en-GB-HollieNeural', name: 'Hollie', gender: 'f', locale: 'en-GB' },
  { id: 'en-GB-MaisieNeural', name: 'Maisie', gender: 'f', locale: 'en-GB' },
  { id: 'en-GB-OliviaNeural', name: 'Olivia', gender: 'f', locale: 'en-GB' },
  { id: 'en-GB-RyanNeural', name: 'Ryan', gender: 'm', locale: 'en-GB' },
  { id: 'en-GB-AlfieNeural', name: 'Alfie', gender: 'm', locale: 'en-GB' },
  { id: 'en-GB-ElliotNeural', name: 'Elliot', gender: 'm', locale: 'en-GB' },
  { id: 'en-GB-EthanNeural', name: 'Ethan', gender: 'm', locale: 'en-GB' },
  { id: 'en-GB-NoahNeural', name: 'Noah', gender: 'm', locale: 'en-GB' },
  { id: 'en-GB-OliverNeural', name: 'Oliver', gender: 'm', locale: 'en-GB' },
  { id: 'en-GB-ThomasNeural', name: 'Thomas', gender: 'm', locale: 'en-GB' },
  { id: 'es-ES-ElviraNeural', name: 'Elvira', gender: 'f', locale: 'es-ES' },
  { id: 'es-ES-AbrilNeural', name: 'Abril', gender: 'f', locale: 'es-ES' },
  { id: 'es-ES-EstrellaNeural', name: 'Estrella', gender: 'f', locale: 'es-ES' },
  { id: 'es-ES-IreneNeural', name: 'Irene', gender: 'f', locale: 'es-ES' },
  { id: 'es-ES-LaiaNeural', name: 'Laia', gender: 'f', locale: 'es-ES' },
  { id: 'es-ES-LiaNeural', name: 'Lia', gender: 'f', locale: 'es-ES' },
  { id: 'es-ES-TrianaNeural', name: 'Triana', gender: 'f', locale: 'es-ES' },
  { id: 'es-ES-VeraNeural', name: 'Vera', gender: 'f', locale: 'es-ES' },
  { id: 'es-ES-XimenaNeural', name: 'Ximena', gender: 'f', locale: 'es-ES' },
  { id: 'es-ES-AlvaroNeural', name: 'Alvaro', gender: 'm', locale: 'es-ES' },
  { id: 'es-ES-ArnauNeural', name: 'Arnau', gender: 'm', locale: 'es-ES' },
  { id: 'es-ES-DarioNeural', name: 'Dario', gender: 'm', locale: 'es-ES' },
  { id: 'es-ES-EliasNeural', name: 'Elias', gender: 'm', locale: 'es-ES' },
  { id: 'es-ES-NilNeural', name: 'Nil', gender: 'm', locale: 'es-ES' },
  { id: 'es-ES-SaulNeural', name: 'Saul', gender: 'm', locale: 'es-ES' },
  { id: 'es-ES-TeoNeural', name: 'Teo', gender: 'm', locale: 'es-ES' },
  { id: 'es-MX-DaliaNeural', name: 'Dalia', gender: 'f', locale: 'es-MX' },
  { id: 'es-MX-BeatrizNeural', name: 'Beatriz', gender: 'f', locale: 'es-MX' },
  { id: 'es-MX-CandelaNeural', name: 'Candela', gender: 'f', locale: 'es-MX' },
  { id: 'es-MX-CarlotaNeural', name: 'Carlota', gender: 'f', locale: 'es-MX' },
  { id: 'es-MX-LarissaNeural', name: 'Larissa', gender: 'f', locale: 'es-MX' },
  { id: 'es-MX-MarinaNeural', name: 'Marina', gender: 'f', locale: 'es-MX' },
  { id: 'es-MX-NuriaNeural', name: 'Nuria', gender: 'f', locale: 'es-MX' },
  { id: 'es-MX-RenataNeural', name: 'Renata', gender: 'f', locale: 'es-MX' },
  { id: 'es-MX-JorgeNeural', name: 'Jorge', gender: 'm', locale: 'es-MX' },
  { id: 'es-MX-CecilioNeural', name: 'Cecilio', gender: 'm', locale: 'es-MX' },
  { id: 'es-MX-GerardoNeural', name: 'Gerardo', gender: 'm', locale: 'es-MX' },
  { id: 'es-MX-LibertoNeural', name: 'Liberto', gender: 'm', locale: 'es-MX' },
  { id: 'es-MX-LucianoNeural', name: 'Luciano', gender: 'm', locale: 'es-MX' },
  { id: 'es-MX-PelayoNeural', name: 'Pelayo', gender: 'm', locale: 'es-MX' },
  { id: 'es-MX-YagoNeural', name: 'Yago', gender: 'm', locale: 'es-MX' },
  { id: 'fr-FR-DeniseNeural', name: 'Denise', gender: 'f', locale: 'fr-FR' },
  { id: 'fr-FR-BrigitteNeural', name: 'Brigitte', gender: 'f', locale: 'fr-FR' },
  { id: 'fr-FR-CelesteNeural', name: 'Celeste', gender: 'f', locale: 'fr-FR' },
  { id: 'fr-FR-CoralieNeural', name: 'Coralie', gender: 'f', locale: 'fr-FR' },
  { id: 'fr-FR-EloiseNeural', name: 'Eloise', gender: 'f', locale: 'fr-FR' },
  { id: 'fr-FR-JacquelineNeural', name: 'Jacqueline', gender: 'f', locale: 'fr-FR' },
  { id: 'fr-FR-JosephineNeural', name: 'Josephine', gender: 'f', locale: 'fr-FR' },
  { id: 'fr-FR-YvetteNeural', name: 'Yvette', gender: 'f', locale: 'fr-FR' },
  { id: 'fr-FR-HenriNeural', name: 'Henri', gender: 'm', locale: 'fr-FR' },
  { id: 'fr-FR-AlainNeural', name: 'Alain', gender: 'm', locale: 'fr-FR' },
  { id: 'fr-FR-ClaudeNeural', name: 'Claude', gender: 'm', locale: 'fr-FR' },
  { id: 'fr-FR-JeromeNeural', name: 'Jerome', gender: 'm', locale: 'fr-FR' },
  { id: 'fr-FR-MauriceNeural', name: 'Maurice', gender: 'm', locale: 'fr-FR' },
  { id: 'fr-FR-YvesNeural', name: 'Yves', gender: 'm', locale: 'fr-FR' },
  { id: 'fr-CA-SylvieNeural', name: 'Sylvie', gender: 'f', locale: 'fr-CA' },
  { id: 'fr-CA-JeanNeural', name: 'Jean', gender: 'm', locale: 'fr-CA' },
  { id: 'fr-CA-AntoineNeural', name: 'Antoine', gender: 'm', locale: 'fr-CA' },
  { id: 'fr-CA-ThierryNeural', name: 'Thierry', gender: 'm', locale: 'fr-CA' },
];

/** Language tag → bare language, matching narration.js. */
function base(tag) {
  return String(tag || '').split('-')[0].toLowerCase();
}

/**
 * The voices that can actually narrate in this language. Offering every
 * voice regardless of the scene's language is how an author ends up with a
 * Brazilian voice reading English text.
 */
export function voicesForLanguage(language) {
  const wanted = base(language);
  if (!wanted) return TTS_VOICES;
  const matching = TTS_VOICES.filter((v) => base(v.locale) === wanted);
  // A language with no voices of its own is better served by the whole list
  // than by an empty picker.
  return matching.length ? matching : TTS_VOICES;
}

/** The voice to start on for a language — its first, which Azure orders sensibly. */
export function defaultVoiceFor(language) {
  return voicesForLanguage(language)[0]?.id || TTS_VOICES[0].id;
}

/** Whether an id is one we offer; the picker should never hold anything else. */
export function isKnownVoice(id) {
  return TTS_VOICES.some((v) => v.id === id);
}
