class ChangeLonDataTypeToFloat < ActiveRecord::Migration
  def self.up
    change_table :memories do |t|
      t.change :lon, :float
    end
  end

  def self.down
    change_table :memories do |t|
      t.change :lon, :integer
    end
  end
end
