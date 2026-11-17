// Cole isto num script novo do Scriptable e rode UMA vez: ele baixa o widget do Cofrin.
const url = 'https://raw.githubusercontent.com/fernandoarantesjr/cofrin/main/widget/cofrin-widget.js';
const fm = FileManager.iCloud();
fm.writeString(fm.joinPath(fm.documentsDirectory(), 'Cofrin.js'), await new Request(url).loadString());
const a = new Alert(); a.title = 'Pronto!'; a.message = 'O script "Cofrin" foi criado. Abra ele e rode uma vez pra entrar com seu e-mail e senha.'; a.addAction('OK'); await a.present();
