// Nothing leaves the machine: an outside picture is answered with an empty, clear drawing (the tile shows its own background), anything else outside is stopped.
const EMPTY = '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"/>'
module.exports = async function seal(p) {
  await p.context().route((u) => !/^https?:\/\/localhost/.test(u.toString()) && !/^(data|blob):/.test(u.toString()), (r) => (r.request().resourceType() === 'image' ? r.fulfill({ status: 200, contentType: 'image/svg+xml', body: EMPTY }) : r.abort()))
}
