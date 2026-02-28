export default async function (req, res) {
  Ore.vue.assign('title', 'Ore Framework')
  Ore.vue.assign('sampleInitialCount', Math.floor(Math.random() * 101))
}
