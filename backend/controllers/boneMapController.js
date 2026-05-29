const OpenAI = require('openai');

const STANDARD_BONES = [
  'hips', 'spine', 'chest', 'upperChest', 'neck', 'head', 'jaw',
  'leftShoulder',  'leftUpperArm',  'leftLowerArm',  'leftHand',
  'rightShoulder', 'rightUpperArm', 'rightLowerArm', 'rightHand',
  'leftUpperLeg',  'leftLowerLeg',  'leftFoot',
  'rightUpperLeg', 'rightLowerLeg', 'rightFoot',
];

exports.mapBones = async (req, res) => {
  const { bones } = req.body;

  if (!Array.isArray(bones) || bones.length === 0) {
    return res.status(400).json({ error: 'bones array is required' });
  }
  if (bones.length > 300) {
    return res.status(400).json({ error: 'Too many bones (max 300)' });
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ error: 'OpenAI API key not configured' });
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const prompt = `You are an expert in 3D character rigging. Map these avatar bone names to standard humanoid bone names.

Standard names (use exact spelling):
${STANDARD_BONES.join(', ')}

Avatar bone names: ${bones.join(', ')}

Rules:
- Map each standard name to the EXACT matching bone name from the avatar list above
- Only include mappings you are confident about
- "left" = character's left side (their left, not viewer's left)
- Return ONLY a valid JSON object

Example: {"hips":"Pelvis","spine":"Spine_01","leftUpperArm":"arm.L"}`;

  try {
    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0,
      response_format: { type: 'json_object' },
    });

    const raw = completion.choices[0]?.message?.content || '{}';
    let parsed;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return res.status(500).json({ error: 'Invalid JSON from model' });
    }

    // Validate: only keep standard→avatar pairs where avatar bone actually exists in the input list
    const bonesSet = new Set(bones);
    const mapping = {};
    for (const [standard, avatarBone] of Object.entries(parsed)) {
      if (
        typeof avatarBone === 'string' &&
        STANDARD_BONES.includes(standard) &&
        bonesSet.has(avatarBone)
      ) {
        mapping[standard] = avatarBone;
      }
    }

    return res.json({ mapping, resolvedCount: Object.keys(mapping).length });
  } catch (err) {
    console.error('[boneMap] OpenAI error:', err?.message || err);
    return res.status(500).json({ error: 'Bone mapping failed' });
  }
};
