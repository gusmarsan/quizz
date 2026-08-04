# Quiz de Duelo — versão 2

Jogo em HTML/CSS/JS com:

- modo solo
- duelo online em sala
- 100 perguntas iniciais
- 4 formatos de pergunta

## Como rodar localmente

```bash
python -m http.server 8000
```

Abra `http://localhost:8000/quiz-duelo-v2/`.

## Como ativar o duelo online

1. Crie um projeto Firebase
2. Ative **Authentication > Anonymous**
3. Crie um **Realtime Database**
4. No jogo, toque em **Configurar online** e cole o objeto `firebaseConfig`

### Regras de protótipo

```json
{
  "rules": {
    "quizRooms": {
      "$roomCode": {
        ".read": "auth != null",
        ".write": "auth != null"
      }
    }
  }
}
```

## Observações

- todos recebem as mesmas perguntas no duelo
- vence quem tiver mais acertos
- empate é decidido pelo menor tempo total
