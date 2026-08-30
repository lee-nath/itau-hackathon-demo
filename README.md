# Copiloto Preventivo de Liquidez

Demonstração conceitual e interativa para o pitch do hackathon. Todos os clientes, saldos, compromissos, ofertas e resultados exibidos são simulados.

## Executar localmente

1. Abra um terminal nesta pasta.
2. Instale as dependências uma vez com `pnpm install`.
3. Inicie com `pnpm run dev`.
4. Abra `http://localhost:3000/`.

Depois da instalação, a demonstração não consulta APIs, CDNs nem serviços financeiros externos. Para validar a versão de apresentação, execute `pnpm run build`.

## Roteiro recomendado

Use **Iniciar demonstração guiada** para percorrer a narrativa principal em até três minutos. A jornada mostra a previsão, inclui um imprevisto, seleciona uma alternativa, pede autorização e verifica o novo fluxo.

## Cenários

- **Saldo em outro banco:** déficit local resolvido com liquidez própria via Open Finance.
- **Fatura antes do salário:** déficit temporal com comparação entre Cofrinho e mudança de vencimento.
- **Recursos insuficientes:** falta consolidada, com negociação antes de crédito.
- **Pix ainda incerto:** renda variável com confirmação explícita da entrada prevista.

Os controles essenciais ficam no painel **Altere o cenário**. Datas, boletos, débitos, parcelas e demais preferências ficam em **Parâmetros avançados**.
