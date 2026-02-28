export default async function (req, res) {
  Ore.vue.assign('title', 'Sample Counter')
  Ore.vue.assign('initialCount', Math.floor(Math.random() * 101))
}
