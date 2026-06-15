// Pure normalize math for glTF ship models (no three, so it unit-tests under node).
// Given a model's world AABB (length on +X, up +Y), returns the transform that makes a
// unit-length model centred in x/z, sitting on the waterline (y=0), bow yawed to −Z.
export function modelTransform(min, max, bowYawDeg) {
  const lengthX = max[0] - min[0]
  return {
    scale: 1 / lengthX,
    offset: [-(min[0] + max[0]) / 2, -min[1], -(min[2] + max[2]) / 2],
    yawRad: bowYawDeg * Math.PI / 180,
    heightUnit: (max[1] - min[1]) / lengthX
  }
}
