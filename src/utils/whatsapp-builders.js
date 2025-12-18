export function buildStudentMaterialsList(materials) {
  return {
    type: "interactive",
    interactive: {
      type: "list",
      body: {
        text: "Estos son los materiales más pedidos por estudiantes. Elegí uno:"
      },
      footer: {
        text: "Bz Print"
      },
      action: {
        button: "Ver materiales",
        sections: [
          {
            title: "Libros y apuntes",
            rows: materials.map(mat => ({
              id: mat.id,
              title: mat.title,
              description: mat.description
            }))
          }
        ]
      }
    }
  };
}

export function buildButtonQuestion({ text, buttons }) {
  return {
    type: "interactive",
    interactive: {
      type: "button",
      body: {
        text
      },
      action: {
        buttons: buttons.map(btn => ({
          type: "reply",
          reply: {
            id: btn.id,
            title: btn.title
          }
        }))
      }
    }
  };
}

