export const CustomDecorator = (): MethodDecorator => {
  return (
    target: Object,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
  ) => {
    const originalMethod = descriptor.value;

    descriptor.value = function () {
      const serviceInstance = this;
      console.log(serviceInstance.myService);
    };

    return descriptor;
  };
};
