export default async function (req, res) {
  Ore.vue.assign('title', 'Ore Framework')
  Ore.vue.assign('count', Math.floor(Math.random() * 101))
}
