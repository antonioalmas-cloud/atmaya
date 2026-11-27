/* ============================================================
   ĀTMĀYÂ — Base de dados de utilizadores (partilhada)
   Este ficheiro vive no servidor e é lido por todos os
   dispositivos. As passwords estão guardadas com hash SHA-256.
   Não edites à mão: usa o Painel de Administração e o botão
   "Descarregar users.js" para gerar uma versão nova deste
   ficheiro, e substitui-a aqui no servidor.
   ============================================================ */

window.ATMAYA_USERS = [
  {
    id: "admin-inicial",
    name: "Administrador",
    username: "admin",
    passHash: "9ecbe20a4c69a60df60d5f5bfd96ea730e817b1565ed9034699be9b169d64d94",
    admin: true,
    apps: ["reiki-sabedoria", "reiki-25", "gestao", "oraculo64"]
  },
  {
    id: "convidado",
    name: "Convidado",
    username: "convidado",
    passHash: "ca978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb",
    admin: false,
    apps: ["reiki-sabedoria"]
  }
];

window.ATMAYA_USERS_META = { v: 1764060000000 };

/* Aplicações instaladas no site. podes acrescentar novas aqui
   ou usar o Painel de Administração > Aplicações. */
window.ATMAYA_APPS = [
  { id: "reiki-sabedoria", name: "Reiki & Sabedoria Japonesa", file: "reiki-sabedoria.html", icon: "霊", desc: "Oráculo de Reiki e sabedoria japonesa" },
  { id: "reiki-25", name: "As 25 Técnicas de Reiki", file: "reiki-25-tecnicas.html", icon: "手", desc: "Enciclopédia das 25 técnicas tradicionais" },
  { id: "gestao", name: "Gestão ĀTMĀYÂ", file: "gestao.html", icon: "管", desc: "Aplicação de gestão integrada" },
  { id: "oraculo64", name: "Oráculo dos 64 Portais", file: "oraculo-64-portais.html", icon: "門", desc: "Oráculo Sagrado dos 64 Portais" }
];

window.ATMAYA_APPS_META = { v: 1764060000000 };
