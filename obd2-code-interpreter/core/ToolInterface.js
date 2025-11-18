/**
 * ToolInterface - Base class for tools
 */

class ToolInterface {
  constructor(name, description) {
    this.name = name;
    this.description = description;
  }

  getDefinition() {
    throw new Error('getDefinition() must be implemented');
  }

  async run(args) {
    throw new Error('run() must be implemented');
  }
}

export default ToolInterface;
